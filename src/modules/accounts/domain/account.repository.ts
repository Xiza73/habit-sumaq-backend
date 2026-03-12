import type { Account } from './account.entity';
import type { AccountType } from './enums/account-type.enum';
import type { Currency } from './enums/currency.enum';

export interface CreateAccountData {
  userId: string;
  name: string;
  type: AccountType;
  currency: Currency;
  balance: number;
  color: string | null;
  icon: string | null;
}

export abstract class AccountRepository {
  abstract findByUserId(userId: string, includeArchived?: boolean): Promise<Account[]>;
  abstract findByUserIdAndName(userId: string, name: string): Promise<Account | null>;
  abstract findById(id: string): Promise<Account | null>;
  abstract save(account: Account): Promise<Account>;
  abstract softDelete(id: string): Promise<void>;
}
