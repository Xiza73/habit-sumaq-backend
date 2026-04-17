import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { FindOrCreateUserUseCase } from '../../../users/application/use-cases/find-or-create-user.use-case';

import { type AuthTokens, GoogleLoginUseCase } from './google-login.use-case';

/**
 * Issues a signed JWT for a test user without going through Google OAuth.
 * Used exclusively by the Playwright e2e suite (habit-sumaq-web/e2e).
 *
 * Triple guard — any failure returns 404 (never 401/403) to avoid
 * confirming the endpoint's existence to an outsider:
 * 1. NODE_ENV must NOT be 'production' (enforced here + env schema)
 * 2. testAuth.enabled must be 'true' (feature flag)
 * 3. x-test-auth-secret header must match config (enforced in the controller)
 *
 * The Zod superRefine in env.schema.ts prevents the process from starting
 * at all when the flag is true in NODE_ENV=production or the secret is
 * absent / shorter than 32 chars.
 */
@Injectable()
export class TestLoginUseCase {
  constructor(
    private readonly config: ConfigService,
    private readonly findOrCreateUser: FindOrCreateUserUseCase,
    private readonly googleLogin: GoogleLoginUseCase,
  ) {}

  async execute(email: string): Promise<AuthTokens> {
    if (this.config.get<string>('app.nodeEnv') === 'production') {
      throw new NotFoundException();
    }

    if (!this.config.get<boolean>('testAuth.enabled')) {
      throw new NotFoundException();
    }

    const user = await this.findOrCreateUser.execute({
      googleId: `test-${email}`,
      email,
      name: email.split('@')[0] || 'Test User',
      avatarUrl: null,
    });

    return this.googleLogin.execute(user);
  }
}
