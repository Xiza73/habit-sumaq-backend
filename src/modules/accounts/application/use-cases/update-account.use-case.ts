import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { AccountRepository } from '../../domain/account.repository';

import type { Account } from '../../domain/account.entity';
import type { UpdateAccountDto } from '../dto/update-account.dto';

@Injectable()
export class UpdateAccountUseCase {
  constructor(private readonly accountRepo: AccountRepository) {}

  async execute(id: string, userId: string, dto: UpdateAccountDto): Promise<Account> {
    const account = await this.accountRepo.findById(id);
    if (!account) {
      throw new DomainException('ACCOUNT_NOT_FOUND', 'Cuenta no encontrada');
    }
    if (account.userId !== userId) {
      throw new DomainException('ACCOUNT_BELONGS_TO_OTHER_USER', 'No tienes acceso a esta cuenta');
    }

    const newName = dto.name !== undefined ? dto.name : account.name;

    if (dto.name !== undefined && dto.name !== account.name) {
      const existing = await this.accountRepo.findByUserIdAndName(userId, dto.name);
      if (existing) {
        throw new DomainException(
          'ACCOUNT_NAME_TAKEN',
          `Ya existe una cuenta con el nombre "${dto.name}"`,
        );
      }
    }

    const newColor = dto.color !== undefined ? dto.color : account.color;
    const newIcon = dto.icon !== undefined ? dto.icon : account.icon;

    account.updateProfile(newName, newColor, newIcon);
    return this.accountRepo.save(account);
  }
}
