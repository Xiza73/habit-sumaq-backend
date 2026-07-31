import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';

import { DomainException } from '@common/exceptions/domain.exception';
import { toCents } from '@common/money/to-cents';
import { isUniqueViolation } from '@common/persistence/postgres-error';
import { normalizeReference } from '@common/text/normalize-reference';
import { CategoryRepository } from '@modules/categories/domain/category.repository';

import { MonthlyServiceParticipant } from '../../domain/entities/monthly-service-participant.entity';
import { MonthlyService } from '../../domain/monthly-service.entity';
import { MonthlyServiceRepository } from '../../domain/monthly-service.repository';
import { MonthlyServiceParticipantRepository } from '../../domain/repositories/monthly-service-participant.repository';
import { currentPeriodInTimezone } from '../../infrastructure/timezone/current-period-in-timezone';

import type {
  CreateMonthlyServiceDto,
  CreateMonthlyServiceParticipantItemDto,
} from '../dto/create-monthly-service.dto';

/**
 * v1.0.0 (`accounts-to-modular-finance`):
 *   - `currency` is REQUIRED on the DTO and used as-is. The legacy
 *     "derive currency from the user's account" logic is gone — payments
 *     debit the currency pool, no account lookup happens here.
 *
 * Batch participant rework: `dto.participants` (optional) lets the caller
 * configure the shared-service split list at create time instead of a
 * separate call. When present and non-empty, the service AND its
 * participants are created atomically inside ONE
 * `dataSource.transaction(manager)`, running the SAME validations as
 * `ReplaceMonthlyServiceParticipantsUseCase` (in-batch normalized-reference
 * uniqueness, `defaultAmount > 0`, `sum <= estimatedAmount`). Empty/omitted
 * `participants` is a strict no-op — the service is created exactly as it
 * was before this behavior existed (no transaction opened at all).
 */
@Injectable()
export class CreateMonthlyServiceUseCase {
  constructor(
    private readonly serviceRepo: MonthlyServiceRepository,
    private readonly categoryRepo: CategoryRepository,
    private readonly participantRepo: MonthlyServiceParticipantRepository,
    private readonly dataSource: DataSource,
    @InjectPinoLogger(CreateMonthlyServiceUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(
    userId: string,
    dto: CreateMonthlyServiceDto,
    timezone: string,
  ): Promise<MonthlyService> {
    // Validate category is owned by user.
    const category = await this.categoryRepo.findById(dto.categoryId);
    if (!category || category.userId !== userId) {
      throw new DomainException('CATEGORY_NOT_FOUND', 'Categoría no encontrada');
    }

    // Active-name uniqueness — DB partial unique index is the source of truth
    // but we check first to translate the violation into a clean domain error.
    const existing = await this.serviceRepo.findActiveByUserIdAndName(userId, dto.name);
    if (existing) {
      throw new DomainException(
        'MONTHLY_SERVICE_NAME_TAKEN',
        'Ya tienes un servicio activo con ese nombre',
      );
    }

    const startPeriod = dto.startPeriod ?? currentPeriodInTimezone(timezone);
    const now = new Date();

    const service = new MonthlyService(
      randomUUID(),
      userId,
      dto.name,
      dto.categoryId,
      dto.currency,
      dto.frequencyMonths ?? 1,
      dto.estimatedAmount ?? null,
      dto.dueDay ?? null,
      startPeriod,
      null,
      true,
      now,
      now,
      null,
    );

    const participants = dto.participants ?? [];
    if (participants.length === 0) {
      // No-transaction fast path — byte-identical to pre-batch behavior.
      const saved = await this.serviceRepo.save(service);
      this.logInfo(saved, userId);
      return saved;
    }

    const batch = this.validateParticipantBatch(participants, service.estimatedAmount);

    let saved: MonthlyService;
    try {
      saved = await this.dataSource.transaction(async (manager) => {
        const persisted = await this.serviceRepo.save(service, manager);
        for (const item of batch) {
          const participant = new MonthlyServiceParticipant({
            id: randomUUID(),
            monthlyServiceId: persisted.id,
            userId,
            reference: item.reference,
            normalizedReference: item.normalizedReference,
            defaultAmount: item.defaultAmount,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          });
          await this.participantRepo.save(participant, manager);
        }
        return persisted;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DomainException(
          'MSP_PARTICIPANT_DUPLICATE_REFERENCE',
          'Ya existe un participante con esa referencia',
        );
      }
      throw error;
    }

    this.logInfo(saved, userId, batch.length);
    return saved;
  }

  private validateParticipantBatch(
    participants: CreateMonthlyServiceParticipantItemDto[],
    estimatedAmount: number | null,
  ): Array<{ reference: string; normalizedReference: string; defaultAmount: number }> {
    const batch = participants.map((item) => ({
      reference: item.reference,
      normalizedReference: normalizeReference(item.reference),
      defaultAmount: item.defaultAmount,
    }));

    for (const item of batch) {
      if (item.defaultAmount <= 0) {
        throw new DomainException(
          'MSP_PARTICIPANT_AMOUNT_NOT_POSITIVE',
          'El monto por defecto debe ser mayor a 0',
        );
      }
    }

    const seenNormalizedReferences = new Set<string>();
    for (const item of batch) {
      if (seenNormalizedReferences.has(item.normalizedReference)) {
        throw new DomainException(
          'MSP_PARTICIPANT_DUPLICATE_REFERENCE',
          'Hay referencias duplicadas dentro de la lista enviada',
        );
      }
      seenNormalizedReferences.add(item.normalizedReference);
    }

    if (estimatedAmount !== null) {
      const batchSumCents = batch.reduce((sum, item) => sum + toCents(item.defaultAmount), 0);
      if (batchSumCents > toCents(estimatedAmount)) {
        throw new DomainException(
          'MSP_PARTICIPANT_SUM_EXCEEDS_ESTIMATED',
          'La suma de montos supera el estimado del servicio',
        );
      }
    }

    return batch;
  }

  private logInfo(saved: MonthlyService, userId: string, participantsCount = 0): void {
    this.logger.info(
      {
        event: 'monthly_service.created',
        serviceId: saved.id,
        userId,
        name: saved.name,
        startPeriod: saved.startPeriod,
        participantsCount,
      },
      'monthly_service.created',
    );
  }
}
