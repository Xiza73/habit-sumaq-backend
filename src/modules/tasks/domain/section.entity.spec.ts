import { DomainException } from '@common/exceptions/domain.exception';

import { Section } from './section.entity';

describe('Section entity', () => {
  function build(overrides: { name?: string; color?: string | null } = {}): Section {
    const now = new Date('2026-04-15T12:00:00.000Z');
    return new Section(
      'sec-1',
      'user-1',
      overrides.name ?? 'Trabajo',
      overrides.color !== undefined ? overrides.color : null,
      1,
      now,
      now,
    );
  }

  it('throws SECTION_NAME_REQUIRED on empty name', () => {
    expect(() => build({ name: '' })).toThrow(DomainException);
    expect(() => build({ name: '' })).toThrow(/SECTION_NAME_REQUIRED|nombre/);
  });

  it('throws SECTION_NAME_TOO_LONG on >60 chars', () => {
    const long = 'x'.repeat(61);
    expect(() => build({ name: long })).toThrow(DomainException);
    try {
      build({ name: long });
      throw new Error('expected throw');
    } catch (e) {
      expect((e as DomainException).code).toBe('SECTION_NAME_TOO_LONG');
    }
  });

  it('accepts a null or hex color', () => {
    expect(build({ color: null }).color).toBeNull();
    expect(build({ color: '#FF6B35' }).color).toBe('#FF6B35');
  });

  it('applyUpdate updates name + color + position and bumps updatedAt', async () => {
    const s = build();
    const before = s.updatedAt;
    await new Promise((r) => setTimeout(r, 1));
    s.applyUpdate({ name: 'Personal', color: '#000000', position: 5 });
    expect(s.name).toBe('Personal');
    expect(s.color).toBe('#000000');
    expect(s.position).toBe(5);
    expect(s.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  it('applyUpdate with undefined fields leaves them untouched', () => {
    const s = build({ color: '#AABBCC' });
    s.applyUpdate({ name: 'Renamed' });
    expect(s.name).toBe('Renamed');
    expect(s.color).toBe('#AABBCC'); // untouched
  });

  it('applyUpdate with explicit null color clears it', () => {
    const s = build({ color: '#AABBCC' });
    s.applyUpdate({ color: null });
    expect(s.color).toBeNull();
  });
});
