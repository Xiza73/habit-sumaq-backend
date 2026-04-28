import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DomainException } from '@common/exceptions/domain.exception';
import { AccountRepository } from '@modules/accounts/domain/account.repository';
import { CategoryRepository } from '@modules/categories/domain/category.repository';

import { MonthlyService } from '../../domain/monthly-service.entity';
import { MonthlyServiceRepository } from '../../domain/monthly-service.repository';
import { currentPeriodInTimezone } from '../../infrastructure/timezone/current-period-in-timezone';

import type { CreateMonthlyServiceDto } from '../dto/create-monthly-service.dto';

@Injectable()
export class CreateMonthlyServiceUseCase {
  constructor(
    private readonly serviceRepo: MonthlyServiceRepository,
    private readonly accountRepo: AccountRepository,
    private readonly categoryRepo: CategoryRepository,
    @InjectPinoLogger(CreateMonthlyServiceUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(
    userId: string,
    dto: CreateMonthlyServiceDto,
    timezone: string,
  ): Promise<MonthlyService> {
    // Validate default account is owned by user and currency matches.
    const account = await this.accountRepo.findById(dto.defaultAccountId);
    if (!account || account.userId !== userId) {
      throw new DomainException('ACCOUNT_NOT_FOUND', 'Cuenta no encontrada');
    }
    if (String(account.currency) !== dto.currency) {
      throw new DomainException(
        'CURRENCY_MISMATCH',
        'La moneda del servicio debe coincidir con la moneda de la cuenta por defecto',
      );
    }

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
      dto.defaultAccountId,
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
