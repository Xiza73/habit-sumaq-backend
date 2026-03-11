import { Injectable } from '@nestjs/common';

import { UserRepository } from '../../domain/user.repository';

import type { User } from '../../domain/user.entity';

export interface GoogleUserProfile {
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

@Injectable()
export class FindOrCreateUserUseCase {
  constructor(private readonly userRepo: UserRepository) {}

  async execute(profile: GoogleUserProfile): Promise<User> {
    const existing = await this.userRepo.findByGoogleId(profile.googleId);
    if (existing) return existing;

    return this.userRepo.create({
      googleId: profile.googleId,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
    });
  }
}
