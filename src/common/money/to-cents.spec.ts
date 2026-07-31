import { toCents } from './to-cents';

describe('toCents', () => {
  it('converts whole amounts to cents', () => {
    expect(toCents(100)).toBe(10000);
    expect(toCents(0)).toBe(0);
  });

  it('converts two-decimal amounts exactly', () => {
    expect(toCents(100.1)).toBe(10010);
    expect(toCents(199.9)).toBe(19990);
    expect(toCents(0.1)).toBe(10);
    expect(toCents(0.2)).toBe(20);
  });

  it('absorbs float drift so exact-equal sums compare equal', () => {
    // 0.1 + 0.2 !== 0.3 in float, but their cents do add up exactly.
    expect(toCents(0.1) + toCents(0.2)).toBe(toCents(0.3));
    expect(toCents(100.1) + toCents(199.9)).toBe(toCents(300));
  });

  it('resolves the * 100 residual error', () => {
    // 1.1 * 100 = 110.00000000000001; rounding fixes it.
    expect(toCents(1.1)).toBe(110);
    expect(toCents(1.15)).toBe(115);
  });
});
