import { DomainException } from '@common/exceptions/domain.exception';

import { type Currency } from '../enums/currency.enum';

export class Money {
  constructor(
    readonly amount: number,
    readonly currency: Currency,
  ) {
    if (amount < 0) {
      throw new DomainException('INVALID_MONEY_AMOUNT', 'El monto no puede ser negativo');
    }
  }

  add(other: Money): Money {
    if (other.currency !== this.currency) {
      throw new DomainException(
        'CURRENCY_MISMATCH',
        'No se pueden sumar montos en diferentes monedas',
      );
    }
    return new Money(this.amount + other.amount, this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }
}
