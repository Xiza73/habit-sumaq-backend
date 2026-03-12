export enum AccountType {
  CHECKING = 'checking',
  SAVINGS = 'savings',
  CASH = 'cash',
  CREDIT_CARD = 'credit_card',
  INVESTMENT = 'investment',
}

/** Las tarjetas de crédito permiten saldo negativo */
export function allowsNegativeBalance(type: AccountType): boolean {
  return type === AccountType.CREDIT_CARD;
}
