import { Injectable } from '@nestjs/common';

import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DomainException } from '@common/exceptions/domain.exception';

import { MonthlyService } from '../../domain/monthly-service.entity';
import { MonthlyServiceRepository } from '../../domain/monthly-service.repository';

import type { SkipMonthDto } from '../dto/skip-month.dto';

/**
 * Advances `lastPaidPeriod` to the next due period without creating a
 * transaction. Used for "free months" or months the user deliberately skips.
 */
@Injectable()
export class SkipMonthlyServiceMonthUseCase {
  constructor(
    private readonly serviceRepo: MonthlyServiceRepository,
    @InjectPinoLogger(SkipMonthlyServiceMonthUseCase.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(id: string, userId: string, dto: SkipMonthDto): Promise<MonthlyService> {
    const service = await this.serviceRepo.findById(id);
    if (!service || service.userId !== userId) {
      throw new DomainException('MONTHLY_SERVICE_NOT_FOUND', 'Servicio mensual no encontrado');
    }

    const skippedPeriod = service.nextDuePeriod();
    service.markPeriodAsPaid(skippedPeriod);
    const saved = await this.serviceRepo.save(service);

    this.logger.info(
      {
        event: 'monthly_service.skipped',
        serviceId: saved.id,
        userId,
        skippedPeriod,
        reason: dto.reason,
      },
      'monthly_service.skipped',
    );
    return saved;
  }
}
