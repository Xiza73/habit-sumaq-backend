import { type DomainException } from '@common/exceptions/domain.exception';

import { buildMonthlyServicePayment } from '../../../domain/__tests__/monthly-service-payment.factory';
import { type MonthlyServicePaymentRepository } from '../../../domain/monthly-service-payment.repository';
import { GetMonthlyServicePaymentUseCase } from '../get-monthly-service-payment.use-case';

describe('GetMonthlyServicePaymentUseCase', () => {
  let repo: jest.Mocked<MonthlyServicePaymentRepository>;
  let useCase: GetMonthlyServicePaymentUseCase;

  beforeEach(() => {
    repo = {
      findByServiceId: jest.fn(),
      findById: jest.fn(),
      findByServiceAndPeriod: jest.fn(),
      save: jest.fn(),
      softDelete: jest.fn(),
    };
    useCase = new GetMonthlyServicePaymentUseCase(repo);
  });

  it('returns the payment when it exists and belongs to the user', async () => {
    const p = buildMonthlyServicePayment({ userId: 'user-1' });
    repo.findById.mockResolvedValue(p);
    await expect(useCase.execute(p.id, 'user-1')).resolves.toBe(p);
  });

  it('throws MONTHLY_SERVICE_PAYMENT_NOT_FOUND for missing id', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(useCase.execute('x', 'user-1')).rejects.toMatchObject({
      code: 'MONTHLY_SERVICE_PAYMENT_NOT_FOUND',
    } satisfies Partial<DomainException>);
  });

  it('throws MONTHLY_SERVICE_PAYMENT_NOT_FOUND when soft-deleted', async () => {
    repo.findById.mockResolvedValue(
      buildMonthlyServicePayment({ userId: 'user-1', deletedAt: new Date() }),
    );
    await expect(useCase.execute('x', 'user-1')).rejects.toMatchObject({
      code: 'MONTHLY_SERVICE_PAYMENT_NOT_FOUND',
    } satisfies Partial<DomainException>);
  });

  it('throws MONTHLY_SERVICE_PAYMENT_BELONGS_TO_OTHER_USER on cross-user access', async () => {
    repo.findById.mockResolvedValue(buildMonthlyServicePayment({ userId: 'someone-else' }));
    await expect(useCase.execute('x', 'user-1')).rejects.toMatchObject({
      code: 'MONTHLY_SERVICE_PAYMENT_BELONGS_TO_OTHER_USER',
    } satisfies Partial<DomainException>);
  });
});
