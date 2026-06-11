import { type PinoLogger } from 'nestjs-pino';

import { buildMockPinoLogger } from '@common/__tests__/pino-logger.mock';
import { Currency } from '@common/enums/currency.enum';
import { type DomainException } from '@common/exceptions/domain.exception';

import { type DebtLoanRepository } from '../../../domain/debt-loan.repository';
import { DebtLoanStatus } from '../../../domain/enums/debt-loan-status.enum';
import { DebtLoanType } from '../../../domain/enums/debt-loan-type.enum';
import { type CreateDebtLoanDto } from '../../dto/create-debt-loan.dto';
import { CreateDebtLoanUseCase } from '../create-debt-loan.use-case';

describe('CreateDebtLoanUseCase', () => {
  let repo: jest.Mocked<DebtLoanRepository>;
  let useCase: CreateDebtLoanUseCase;
  let logger: ReturnType<typeof buildMockPinoLogger>;

  const baseDto: CreateDebtLoanDto = {
    type: DebtLoanType.DEBT,
    currency: Currency.PEN,
    amount: 500,
    reference: 'Juan',
  };

  beforeEach(() => {
    repo = {
      findByUserId: jest.fn(),
      findById: jest.fn(),
      aggregateByReference: jest.fn(),
      findPendingByNormalizedReference: jest.fn(),
      save: jest.fn().mockImplementation((debt) => Promise.resolve(debt)),
      softDelete: jest.fn(),
    };
    logger = buildMockPinoLogger();
    useCase = new CreateDebtLoanUseCase(repo, logger as unknown as PinoLogger);
  });

  it('creates a PENDING row with remainingAmount = amount', async () => {
    const result = await useCase.execute('user-1', baseDto);

    expect(result.status).toBe(DebtLoanStatus.PENDING);
    expect(result.amount).toBe(500);
    expect(result.remainingAmount).toBe(500);
    expect(result.userId).toBe('user-1');
    expect(result.type).toBe(DebtLoanType.DEBT);
    expect(result.currency).toBe(Currency.PEN);
  });

  it('trims the reference whitespace before persisting', async () => {
    const result = await useCase.execute('user-1', { ...baseDto, reference: '  Juan  ' });
    expect(result.reference).toBe('Juan');
  });

  it('throws DEBT_LOAN_REFERENCE_REQUIRED when reference is whitespace-only', async () => {
    await expect(useCase.execute('user-1', { ...baseDto, reference: '   ' })).rejects.toMatchObject(
      { code: 'DEBT_LOAN_REFERENCE_REQUIRED' } satisfies Partial<DomainException>,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('uses dto.date when provided, otherwise current time', async () => {
    const result = await useCase.execute('user-1', {
      ...baseDto,
      date: '2026-01-15T12:00:00.000Z',
    });
    expect(result.date.toISOString()).toBe('2026-01-15T12:00:00.000Z');
  });

  it('persists null categoryId when omitted', async () => {
    const result = await useCase.execute('user-1', baseDto);
    expect(result.categoryId).toBeNull();
  });

  it('logs the creation event', async () => {
    await useCase.execute('user-1', baseDto);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'debt_loan.created', userId: 'user-1' }),
      'debt_loan.created',
    );
  });
});
