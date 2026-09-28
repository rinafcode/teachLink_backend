import { ReportingService } from './reporting.service';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import { Refund, RefundStatus } from '../entities/refund.entity';
import { Invoice, InvoiceStatus } from '../entities/invoice.entity';

describe('ReportingService', () => {
  let service: ReportingService;
  let paymentRepo: { find: jest.Mock };
  let refundRepo: { find: jest.Mock };
  let invoiceRepo: { find: jest.Mock };

  beforeEach(() => {
    paymentRepo = { find: jest.fn() };
    refundRepo = { find: jest.fn() };
    invoiceRepo = { find: jest.fn() };

    service = new ReportingService(paymentRepo as any, refundRepo as any, invoiceRepo as any);
  });

  describe('generateDailyReconciliationReport', () => {
    it('sums payment amounts exactly even when given string decimals or IEEE-754 drift values', async () => {
      paymentRepo.find.mockResolvedValue([
        { id: 'p1', amount: '0.1', status: PaymentStatus.COMPLETED, provider: 'stripe' },
        { id: 'p2', amount: '0.2', status: PaymentStatus.COMPLETED, provider: 'stripe' },
        { id: 'p3', amount: 19.99, status: PaymentStatus.COMPLETED, provider: 'stripe' },
      ]);

      const result = await service.generateDailyReconciliationReport(new Date('2026-08-29'));
      // 0.1 + 0.2 + 19.99 = 20.29
      expect(result.totalRevenue).toBe(20.29);
      expect(result.totalTransactions).toBe(3);
      expect(result.transactions[0].amount).toBe(0.1);
      expect(result.transactions[2].amount).toBe(19.99);
    });
  });

  describe('generateRefundReport', () => {
    it('sums refund amounts with decimal precision', async () => {
      refundRepo.find.mockResolvedValue([
        {
          id: 'r1',
          paymentId: 'p1',
          amount: '14.99',
          status: RefundStatus.PROCESSED,
          reason: 'request',
        },
        {
          id: 'r2',
          paymentId: 'p2',
          amount: 5.01,
          status: RefundStatus.PROCESSED,
          reason: 'duplicate',
        },
      ]);

      const result = await service.generateRefundReport(
        new Date('2026-08-01'),
        new Date('2026-08-29'),
      );
      expect(result.totalRefunded).toBe(20);
      expect(result.refundCount).toBe(2);
      expect(result.refunds[0].amount).toBe(14.99);
    });
  });

  describe('generateRevenueRecognitionReport', () => {
    it('computes gross, refunds, net, subscription and one-off revenues with exact decimal arithmetic', async () => {
      paymentRepo.find.mockResolvedValue([
        { id: 'p1', amount: '29.99', isSubscription: true, status: PaymentStatus.COMPLETED },
        { id: 'p2', amount: 49.99, isSubscription: false, status: PaymentStatus.COMPLETED },
        { id: 'p3', amount: '19.99', isSubscription: true, status: PaymentStatus.COMPLETED },
      ]);

      refundRepo.find.mockResolvedValue([
        { id: 'r1', amount: '9.99', status: RefundStatus.PROCESSED },
      ]);

      invoiceRepo.find.mockResolvedValue([
        { id: 'inv1', amount: 49.99, taxAmount: '5.00', status: InvoiceStatus.PAID },
        { id: 'inv2', amount: 29.99, taxAmount: 3.0, status: InvoiceStatus.PAID },
      ]);

      const result = await service.generateRevenueRecognitionReport(
        new Date('2026-08-01'),
        new Date('2026-08-29'),
      );

      // Gross: 29.99 + 49.99 + 19.99 = 99.97
      expect(result.grossRevenue).toBe(99.97);
      // Refunds: 9.99
      expect(result.totalRefunds).toBe(9.99);
      // Net: 99.97 - 9.99 = 89.98
      expect(result.netRevenue).toBe(89.98);
      // Subscription: 29.99 + 19.99 = 49.98
      expect(result.breakdown.subscriptionRevenue).toBe(49.98);
      // One-off: 99.97 - 49.98 = 49.99
      expect(result.breakdown.oneOffRevenue).toBe(49.99);
      // Tax: 5.00 + 3.00 = 8.00
      expect(result.totalTaxCollected).toBe(8);
    });
  });

  describe('generateTaxReport', () => {
    it('aggregates taxable amount and collected tax accurately', async () => {
      invoiceRepo.find.mockResolvedValue([
        { id: 'inv1', amount: '100.00', taxAmount: '19.00', status: InvoiceStatus.PAID },
        { id: 'inv2', amount: 50.0, taxAmount: 3.75, status: InvoiceStatus.SENT },
      ]);

      const result = await service.generateTaxReport(
        new Date('2026-08-01'),
        new Date('2026-08-29'),
      );

      expect(result.totalInvoices).toBe(2);
      expect(result.totalTaxableAmount).toBe(150);
      expect(result.totalTaxCollected).toBe(22.75);
    });
  });
});
