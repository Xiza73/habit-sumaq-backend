/**
 * Normalizes a free-text reference (e.g. `debts_loans.reference`,
 * `monthly_service_participants.reference`) for case/accent-insensitive
 * matching and uniqueness checks.
 *
 * `trim()` + `toLowerCase()` + `NFD` diacritic strip — pure JS, no DB
 * roundtrip. Used at the application boundary (before persisting
 * `normalizedReference` plain columns) since Postgres' `unaccent()` is
 * STABLE, not IMMUTABLE, and can't be used in a generated column or index
 * expression (see migration `1741000028000` for the documented wall).
 *
 * NOTE: `NFD`-strip is not byte-identical to Postgres `unaccent` for
 * exotic glyphs, but is equivalent for the Latin-script references this
 * feature targets — an accepted tradeoff.
 */
export function normalizeReference(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
