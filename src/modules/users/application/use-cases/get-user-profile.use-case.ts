import { Injectable } from '@nestjs/common';

import { DomainException } from '@common/exceptions/domain.exception';

import { UserRepository } from '../../domain/user.repository';

import type { User } from '../../domain/user.entity';

@Injectable()
export class GetUserProfileUseCase {
  constructor(private readonly userRepo: UserRepository) {}

  async execute(userId: string): Promise<User> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new DomainException('USER_NOT_FOUND', 'Usuario no encontrado');
    return user;
  }
}
