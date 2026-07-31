import { normalizeReference } from './normalize-reference';

describe('normalizeReference', () => {
  it('lowercases a simple name', () => {
    expect(normalizeReference('Ana')).toBe('ana');
  });

  it('strips diacritics (accents)', () => {
    expect(normalizeReference('José')).toBe('jose');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeReference('  Luis  ')).toBe('luis');
  });

  it('combines trim, lowercase and accent-strip together', () => {
    expect(normalizeReference('  José María  ')).toBe('jose maria');
  });
});
