import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CurrencyPoolService } from '../application/currency-pool.service';
import { CurrencyPoolRepository } from '../domain/currency-pool.repository';
import { CurrencyPoolOrmEntity } from '../infrastructure/persistence/currency-pool.orm-entity';
import { CurrencyPoolRepositoryImpl } from '../infrastructure/persistence/currency-pool.repository.impl';

/**
 * Internal-only module. NO controller — the pool is never exposed via
 * HTTP. Consumers are other backend modules that import
 * `CurrencyPoolService` to record balance deltas (Phase A4+ wires the
 * actual callers: `AddBudgetMovementUseCase`, `PayMonthlyServiceUseCase`,
 * `SettleDebtUseCase` real-payment).
 *
 * Exports both the repo (for any direct read needs, e.g. the audit script
 * in A1-B.2) and the service (the mutation entry point).
 */
@Module({
  imports: [TypeOrmModule.forFeature([CurrencyPoolOrmEntity])],
  providers: [
    { provide: CurrencyPoolRepository, useClass: CurrencyPoolRepositoryImpl },
    CurrencyPoolService,
  ],
  exports: [CurrencyPoolRepository, CurrencyPoolService],
})
export class CurrencyPoolsModule {}
