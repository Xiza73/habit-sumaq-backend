/**
 * Direction of the obligation.
 *
 *  - `DEBT`: the user OWES someone. The user is the borrower; the user
 *    must eventually pay this back. A real-payment settle DEBITS the
 *    user's currency pool (money flowing out).
 *
 *  - `LOAN`: the user LENT to someone. The user is the lender; someone
 *    must eventually pay them back. A real-payment settle CREDITS the
 *    user's currency pool (money flowing in).
 *
 * Stored as `varchar(4) + CHECK` in postgres — not a postgres ENUM type
 * — to keep migrations cheap.
 */
export enum DebtLoanType {
  DEBT = 'DEBT',
  LOAN = 'LOAN',
}
