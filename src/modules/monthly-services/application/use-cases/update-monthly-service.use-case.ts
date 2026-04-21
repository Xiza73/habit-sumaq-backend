import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';
import { AccountRepository } from '@modules/accounts/domain/account.repository';
import { CategoryRepository } from '@modules/categories/domain/category.repository';

import { MonthlyService } from '../../domain/monthly-service.entity';
import { MonthlyServiceRepository } from '../../domain/monthly-service.repository';

import type { UpdateMonthlyServiceDto } from '../dto/update-monthly-service.dto';

/**
 * Partial-update use case. Currency and startPeriod are non-editable at the
 * DTO level — the DTO omits them. Name changes re-check the active-name
 * uniqueness guard.
 */
@Injectable()
export class UpdateMonthlyServiceUseCase {
  constructor(
    private readonly serviceRepo: MonthlyServiceRepository,
    private readonly accountRepo: AccountRepository,
    private readonly categoryRepo: CategoryRepository,
  ) {}

  async execute(id: string, userId: string, dto: UpdateMonthlyServiceDto): Promise<MonthlyService> {
    const service = await this.serviceRepo.findById(id);
    if (!service || service.userId !== userId) {
      throw new DomainException('MONTHLY_SERVICE_NOT_FOUND', 'Servicio mensual no encontrado');
    }

    if (dto.defaultAccountId !== undefined) {
      const account = await this.accountRepo.findById(dto.defaultAccountId);
      if (!account || account.userId !== userId) {
        throw new DomainException('ACCOUNT_NOT_FOUND', 'Cuenta no encontrada');
      }
      if (String(account.currency) !== service.currency) {
        throw new DomainException(
          'CURRENCY_MISMATCH',
          'La cuenta debe tener la misma moneda que el servicio',
        );
      }
      service.defaultAccountId = dto.defaultAccountId;
    }

    if (dto.categoryId !== undefined) {
      const category = await this.categoryRepo.findById(dto.categoryId);
      if (!category || category.userId !== userId) {
        throw new DomainException('CATEGORY_NOT_FOUND', 'Categoría no encontrada');
      }
      service.categoryId = dto.categoryId;
    }

    if (dto.name !== undefined && dto.name !== service.name) {
      if (service.isActive) {
        const existing = await this.serviceRepo.findActiveByUserIdAndName(userId, dto.name);
        if (existing && existing.id !== service.id) {
          throw new DomainException(
            'MONTHLY_SERVICE_NAME_TAKEN',
            'Ya tienes un servicio activo con ese nombre',
          );
        }
      }
      service.name = dto.name;
    }

    if (dto.estimatedAmount !== undefined) {
      service.estimatedAmount = dto.estimatedAmount ?? null;
    }
    if (dto.dueDay !== undefined) {
      service.dueDay = dto.dueDay ?? null;
    }

    service.updatedAt = new Date();
    return this.serviceRepo.save(service);
  }
}
