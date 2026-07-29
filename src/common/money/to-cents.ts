/**
 * Converts a money amount (up to 2 decimal places, e.g. a NUMERIC(14,2) value)
 * into an exact integer number of cents.
 *
 * Summing money as JS floats drifts (0.1 + 0.2 = 0.30000000000000004), which
 * breaks exact-equality comparisons on decimal totals. Convert to integer cents
 * first, then add/compare in the integer domain to avoid that drift.
 *
 * `Math.round` absorbs the residual float error introduced by `* 100` itself
 * (e.g. 1.1 * 100 = 110.00000000000001).
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}
