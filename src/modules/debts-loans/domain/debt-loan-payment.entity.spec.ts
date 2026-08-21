import { Currency } from '@common/enums/currency.enum';

import { DebtLoanPayment } from './debt-loan-payment.entity';

function build(over: Partial<{ amount: number; note: string | null; paidAt: Date }> = {}) {
  return new DebtLoanPayment(
    'pay-1',
    'dl-1',
    over.amount ?? 100,
    Currency.PEN,
    over.note !== undefined ? over.note : null,
    new Date('2026-05-01T10:00:00.000Z'),
    over.paidAt ?? new Date('2026-05-01T10:00:00.000Z'),
  );
}

describe('DebtLoanPayment', () => {
  describe('applyEdit', () => {
    it('edits the amount', () => {
      const p = build();
      p.applyEdit({ amount: 250.456 });
      expect(p.amount).toBe(250.46);
    });

    it('edits the note, and null clears it', () => {
      const p = build({ note: 'algo' });
      p.applyEdit({ note: null });
      expect(p.note).toBeNull();
    });

    it('edits paidAt — the date the payment actually happened', () => {
      const p = build();
      p.applyEdit({ paidAt: new Date('2026-04-12T00:00:00.000Z') });
      expect(p.paidAt.toISOString()).toBe('2026-04-12T00:00:00.000Z');
    });

    it('NEVER touches createdAt when paidAt moves', () => {
      // `createdAt` is the audit trail: when this row was written. `paidAt` is
      // the business fact: when the money moved. Backdating a payment must not
      // rewrite the record of when it was entered — that is what makes the
      // audit trail worth having.
      const p = build();
      const audit = p.createdAt.toISOString();

      p.applyEdit({ paidAt: new Date('2020-01-01T00:00:00.000Z') });

      expect(p.createdAt.toISOString()).toBe(audit);
    });

    it('leaves paidAt alone when the edit does not mention it', () => {
      const p = build();
      p.applyEdit({ amount: 50 });
      expect(p.paidAt.toISOString()).toBe('2026-05-01T10:00:00.000Z');
    });
  });

  it('defaults paidAt to createdAt for a payment created right now', () => {
    // A settle records both at once; they only diverge when the user
    // backdates it afterwards.
    const now = new Date('2026-05-01T10:00:00.000Z');
    const p = new DebtLoanPayment('pay-1', 'dl-1', 100, Currency.PEN, null, now, now);

    expect(p.paidAt.toISOString()).toBe(p.createdAt.toISOString());
  });
});
