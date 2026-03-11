import { randomUUID } from 'node:crypto';

import { RefreshToken } from '../refresh-token.entity';

export function buildRefreshToken(overrides: Partial<RefreshToken> = {}): RefreshToken {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  return new RefreshToken(
    overrides.id ?? randomUUID(),
    overrides.userId ?? 'user-test',
    overrides.token ?? 'hashed-token-test',
    overrides.expiresAt ?? expiresAt,
    overrides.revokedAt ?? null,
    overrides.createdAt ?? new Date('2026-01-01'),
  );
}
