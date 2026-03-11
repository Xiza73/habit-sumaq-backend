import { randomUUID } from 'node:crypto';

import { User } from '../user.entity';

export function buildUser(overrides: Partial<User> = {}): User {
  return new User(
    overrides.id ?? randomUUID(),
    overrides.googleId ?? 'google-id-test',
    overrides.email ?? 'test@example.com',
    overrides.name ?? 'Test User',
    overrides.avatarUrl ?? null,
    overrides.isActive ?? true,
    overrides.createdAt ?? new Date('2026-01-01'),
    overrides.updatedAt ?? new Date('2026-01-01'),
    overrides.deletedAt ?? null,
  );
}
