import { PaymentReconciliationJob } from './reconciliation.service';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import { AuditAction } from '../../audit-log/enums/audit-action.enum';

describe('PaymentReconciliationJob', () => {
  let service: PaymentReconciliationJob;
  let paymentRepo: { find: jest.Mock };
  let auditLogService: { log: jest.Mock };

  beforeEach(() => {
    paymentRepo = {
      find: jest.fn(),
    };
    auditLogService = {
      log: jest.fn().mockResolvedValue({}),
    };

    service = new PaymentReconciliationJob(
      paymentRepo as any,
      auditLogService as any,
      { get: jest.fn() } as any,
      { get: jest.fn() } as any,
    );
  });

  it('returns no discrepancies when local and provider transactions fully match', async () => {
    paymentRepo.find.mockResolvedValue([
      {
        id: 'local-1',
        providerPaymentId: 'pi_1',
        amount: 100,
        status: PaymentStatus.COMPLETED,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
      },
    ]);
    jest.spyOn(service as any, 'fetchProviderTransactions').mockResolvedValue([
      { id: 'pi_1', amount: 100, status: 'succeeded' },
    ]);

    const report = await service.runReconciliation(
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-02T00:00:00.000Z'),
    );

    expect(report.mismatches).toHaveLength(0);
    expect(report.summary.missingInProvider).toBe(0);
    expect(report.summary.missingLocally).toBe(0);
    expect(auditLogService.log).not.toHaveBeenCalled();
  });

  it('logs a discrepancy when a local payment is missing from the provider', async () => {
    paymentRepo.find.mockResolvedValue([
      {
        id: 'local-1',
        providerPaymentId: 'pi_1',
        amount: 100,
        status: PaymentStatus.COMPLETED,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
      },
    ]);
    jest.spyOn(service as any, 'fetchProviderTransactions').mockResolvedValue([]);

    const report = await service.runReconciliation(
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-02T00:00:00.000Z'),
    );

    expect(report.mismatches).toHaveLength(1);
    expect(report.mismatches[0].reason).toBe('missing_in_provider');
    expect(report.summary.missingInProvider).toBe(1);
    expect(auditLogService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.PAYMENT_RECONCILIATION_MISMATCH }),
    );
  });

  it('logs a discrepancy when a provider transaction is missing locally', async () => {
    paymentRepo.find.mockResolvedValue([]);
    jest.spyOn(service as any, 'fetchProviderTransactions').mockResolvedValue([
      { id: 'pi_1', amount: 100, status: 'succeeded' },
    ]);

    const report = await service.runReconciliation(
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-02T00:00:00.000Z'),
    );

    expect(report.mismatches).toHaveLength(1);
    expect(report.mismatches[0].reason).toBe('missing_locally');
    expect(report.summary.missingLocally).toBe(1);
  });

  it('logs amount and status mismatches for the same transaction id', async () => {
    paymentRepo.find.mockResolvedValue([
      {
        id: 'local-1',
        providerPaymentId: 'pi_1',
        amount: 100,
        status: PaymentStatus.COMPLETED,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
      },
    ]);
    jest.spyOn(service as any, 'fetchProviderTransactions').mockResolvedValue([
      { id: 'pi_1', amount: 75, status: 'failed' },
    ]);

    const report = await service.runReconciliation(
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-02T00:00:00.000Z'),
    );

    expect(report.mismatches).toHaveLength(1);
    expect(report.mismatches[0].reason).toBe('mismatch');
    expect(report.mismatches[0].issues).toEqual(expect.arrayContaining(['amount', 'status']));
  });
});
