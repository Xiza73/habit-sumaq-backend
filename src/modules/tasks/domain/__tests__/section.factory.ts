import { randomUUID } from 'node:crypto';

import { Section } from '../section.entity';

interface SectionOverrides {
  id?: string;
  userId?: string;
  name?: string;
  color?: string | null;
  position?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export function makeSection(overrides: SectionOverrides = {}): Section {
  const now = new Date('2026-04-15T12:00:00.000Z');
  return new Section(
    overrides.id ?? randomUUID(),
    overrides.userId ?? 'user-test-id',
    overrides.name ?? 'Trabajo',
    overrides.color !== undefined ? overrides.color : null,
    overrides.position ?? 1,
    overrides.createdAt ?? now,
    overrides.updatedAt ?? now,
  );
}
