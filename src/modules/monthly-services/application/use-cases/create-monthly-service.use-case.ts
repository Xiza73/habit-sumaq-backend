import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DomainException } from '@common/exceptions/domain.exception';
import { CategoryRepository } from '@modules/categories/domain/category.repository';

import { MonthlyService } from '../../domain/monthly-service.entity';
import { MonthlyServiceRepository } from '../../domain/monthly-service.repository';
import { currentPeriodInTimezone } from '../../infrastructure/timezone/current-period-in-timezone';

import type { CreateMonthlyServiceDto } from '../dto/create-monthly-service.dto';

/**
 * v1.0.0 (`accounts-to-modular-finance`, Phase A6-W.4):
 *   - `defaultAccountId` is OPTIONAL. The legacy "must reference an
 *     existing user account + currency must match" check is gone — the
 *     field carries no behavioural weight anymore (payments debit the
 *     pool). If the caller sends a value we trust it without lookup;
 *     it'll be dropped entirely in A7-B.
 *   - `currency` is REQUIRED on the DTO and used as-is. No derivation
 *     from the account.
 */
@Injectable()
export class CreateMonthlyServiceUseCase {
  constructor(
    private readonly serviceRepo: MonthlyServiceRepository,
    private readonly categoryRepo: CategoryRepository,
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
      dto.defaultAccountId ?? null,
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

    const saved = await this.serviceRepo.save(service);
    this.logger.info(
      {
        event: 'monthly_service.created',
        serviceId: saved.id,
        userId,
        name: saved.name,
        startPeriod: saved.startPeriod,
      },
      'monthly_service.created',
    );
    return saved;
  }
}
