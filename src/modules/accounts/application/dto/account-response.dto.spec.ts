import { buildAccount } from '../../domain/__tests__/account.factory';
import { AccountType } from '../../domain/enums/account-type.enum';
import { Currency } from '../../domain/enums/currency.enum';

import { AccountResponseDto } from './account-response.dto';

describe('AccountResponseDto.fromDomain()', () => {
  it('should map all fields from a domain Account', () => {
    const account = buildAccount({
      name: 'BCP Soles',
      type: AccountType.CHECKING,
      currency: Currency.PEN,
      balance: 1500,
      color: '#4CAF50',
      icon: 'wallet',
      isArchived: false,
    });

    const dto = AccountResponseDto.fromDomain(account);

    expect(dto.id).toBe(account.id);
    expect(dto.userId).toBe(account.userId);
    expect(dto.name).toBe('BCP Soles');
    expect(dto.type).toBe(AccountType.CHECKING);
    expect(dto.currency).toBe(Currency.PEN);
    expect(dto.balance).toBe(1500);
    expect(dto.color).toBe('#4CAF50');
    expect(dto.icon).toBe('wallet');
    expect(dto.isArchived).toBe(false);
    expect(dto.createdAt).toBe(account.createdAt);
    expect(dto.updatedAt).toBe(account.updatedAt);
  });

  it('should map nullable fields correctly when null', () => {
    const account = buildAccount({ color: null, icon: null });

    const dto = AccountResponseDto.fromDomain(account);

    expect(dto.color).toBeNull();
    expect(dto.icon).toBeNull();
  });
});
