import { type AuditRow, DRIFT_TOLERANCE, summarizeAuditResult } from '../balance-audit';

function row(overrides: Partial<AuditRow>): AuditRow {
  return {
    accountId: 'acc-1',
    userId: 'user-1',
    currency: 'PEN',
    actual: '100.00',
    expected: '100.00',
    diff: '0.00',
    ...overrides,
  };
}

describe('summarizeAuditResult', () => {
  describe('CLEAN status', () => {
    it('marks an empty input as CLEAN with zero counts', () => {
      const result = summarizeAuditResult([]);
      expect(result.status).toBe('CLEAN');
      expect(result.totalAccounts).toBe(0);
      expect(result.totalDriftRows).toBe(0);
      expect(result.drifts).toEqual([]);
    });

    it('marks all-zero diff rows as CLEAN', () => {
      const result = summarizeAuditResult([
        row({ accountId: 'a1', diff: '0.00' }),
        row({ accountId: 'a2', diff: '0.00' }),
      ]);
      expect(result.status).toBe('CLEAN');
      expect(result.totalAccounts).toBe(2);
      expect(result.totalDriftRows).toBe(0);
    });

    it('treats sub-half-cent drift as benign noise (tolerance is 0.005)', () => {
      const result = summarizeAuditResult([
        row({ accountId: 'a1', diff: '0.004' }),
        row({ accountId: 'a2', diff: '-0.004' }),
      ]);
      expect(result.status).toBe('CLEAN');
      expect(result.totalDriftRows).toBe(0);
    });
  });

  describe('DRIFT_DETECTED status', () => {
    it('flags any row whose |diff| exceeds the tolerance', () => {
      const result = summarizeAuditResult([
        row({ accountId: 'a1', diff: '0.00' }),
        row({ accountId: 'a2', diff: '0.01' }),
      ]);
      expect(result.status).toBe('DRIFT_DETECTED');
      expect(result.totalAccounts).toBe(2);
      expect(result.totalDriftRows).toBe(1);
      expect(result.drifts[0].accountId).toBe('a2');
    });

    it('treats negative drift symmetrically', () => {
      const result = summarizeAuditResult([row({ accountId: 'a1', diff: '-50.00' })]);
      expect(result.status).toBe('DRIFT_DETECTED');
      expect(result.totalDriftRows).toBe(1);
    });

    it('preserves all drifting rows in the output, not just the first', () => {
      const result = summarizeAuditResult([
        row({ accountId: 'a1', diff: '100' }),
        row({ accountId: 'a2', diff: '-50' }),
        row({ accountId: 'a3', diff: '0' }),
        row({ accountId: 'a4', diff: '0.0001' }),
      ]);
      expect(result.totalDriftRows).toBe(2);
      expect(result.drifts.map((d) => d.accountId).sort()).toEqual(['a1', 'a2']);
    });

    it('handles the boundary value (exactly at tolerance) as clean', () => {
      // The check is `|diff| > DRIFT_TOLERANCE`, so equality is not drift.
      const result = summarizeAuditResult([
        row({ accountId: 'a1', diff: String(DRIFT_TOLERANCE) }),
      ]);
      expect(result.status).toBe('CLEAN');
    });

    it('handles just-over-tolerance as drift', () => {
      const result = summarizeAuditResult([
        row({ accountId: 'a1', diff: String(DRIFT_TOLERANCE + 0.001) }),
      ]);
      expect(result.status).toBe('DRIFT_DETECTED');
    });
  });

  describe('numeric parsing (pg returns NUMERIC as string)', () => {
    it('correctly compares string-valued diffs', () => {
      const result = summarizeAuditResult([
        row({ diff: '0.00' }),
        row({ diff: '0.01' }),
        row({ diff: '-100.50' }),
      ]);
      expect(result.totalDriftRows).toBe(2);
    });
  });
});
