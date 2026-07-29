import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { Invoice, InvoiceStatus } from '../entities/invoice.entity';
import { Payment, PaymentStatus, PaymentMethod } from '../entities/payment.entity';

/**
 * Unit and integration tests for InvoicesService
 * 
 * Covers:
 *  - Sequence-based invoice number generation
 *  - Uniqueness enforcement via database constraint
 *  - Concurrency testing (parallel invoice generation)
 *  - Error handling for unique constraint violations
 *  - Invoice numbering is monotonically increasing
 */
describe('InvoicesService (Invoice Number Sequencing)', () => {
  let service: InvoicesService;
  let invoiceRepo: Repository<Invoice>;
  let paymentRepo: Repository<Payment>;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        InvoicesService,
        {
          provide: getRepositoryToken(Invoice),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            query: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
    invoiceRepo = module.get<Repository<Invoice>>(getRepositoryToken(Invoice));
    paymentRepo = module.get<Repository<Payment>>(getRepositoryToken(Payment));
  });

  afterEach(async () => {
    await module.close();
  });

  describe('Invoice Number Generation (Unit)', () => {
    it('should generate invoice numbers in sequence format INV-<6-digit-padded>', async () => {
      const mockInvoice: Partial<Invoice> = {
        id: 'inv-1',
        invoiceNumber: 'INV-000001',
        amount: 100,
        totalAmount: 100,
        currency: 'USD',
        status: InvoiceStatus.PAID,
        issuedDate: new Date(),
      };

      const mockPayment: Partial<Payment> = {
        id: 'pay-1',
        userId: 'user-1',
        amount: 100,
        currency: 'USD',
        status: PaymentStatus.COMPLETED,
        method: PaymentMethod.CREDIT_CARD,
      };

      (invoiceRepo.query as jest.Mock).mockResolvedValue([{ seq_value: '000001' }]);
      (invoiceRepo.create as jest.Mock).mockReturnValue(mockInvoice);
      (invoiceRepo.save as jest.Mock).mockResolvedValue(mockInvoice);
      (paymentRepo.findOne as jest.Mock).mockResolvedValue(mockPayment);

      const result = await service.generateAndArchiveInvoice(mockPayment as Payment);

      expect(result.invoiceNumber).toMatch(/^INV-\d{6}$/);
      expect(result.invoiceNumber).toBe('INV-000001');
    });

    it('should query the database sequence nextval function', async () => {
      const mockPayment: Partial<Payment> = {
        id: 'pay-1',
        userId: 'user-1',
        amount: 100,
        currency: 'USD',
        status: PaymentStatus.COMPLETED,
        method: PaymentMethod.CREDIT_CARD,
      };

      const mockInvoice: Partial<Invoice> = {
        id: 'inv-1',
        invoiceNumber: 'INV-000042',
      };

      (invoiceRepo.query as jest.Mock).mockResolvedValue([{ seq_value: '000042' }]);
      (invoiceRepo.create as jest.Mock).mockReturnValue(mockInvoice);
      (invoiceRepo.save as jest.Mock).mockResolvedValue(mockInvoice);
      (paymentRepo.findOne as jest.Mock).mockResolvedValue(mockPayment);

      await service.generateAndArchiveInvoice(mockPayment as Payment);

      expect(invoiceRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('nextval(\'invoice_number_seq\')'),
      );
    });

    it('should handle unique constraint violation with ConflictException', async () => {
      const mockPayment: Partial<Payment> = {
        id: 'pay-1',
        userId: 'user-1',
        amount: 100,
        currency: 'USD',
      };

      const mockInvoice: Partial<Invoice> = {
        invoiceNumber: 'INV-000001',
      };

      // Simulate unique constraint violation (PostgreSQL error code 23505)
      const uniqueViolationError = new Error('duplicate key value') as any;
      uniqueViolationError.code = '23505';

      (invoiceRepo.query as jest.Mock).mockResolvedValue([{ seq_value: '000001' }]);
      (invoiceRepo.create as jest.Mock).mockReturnValue(mockInvoice);
      (invoiceRepo.save as jest.Mock).mockRejectedValue(uniqueViolationError);
      (paymentRepo.findOne as jest.Mock).mockResolvedValue(mockPayment);

      await expect(
        service.generateAndArchiveInvoice(mockPayment as Payment),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.generateAndArchiveInvoice(mockPayment as Payment),
      ).rejects.toThrow(/Invoice number collision detected/);
    });

    it('should throw error if sequence retrieval fails', async () => {
      const mockPayment: Partial<Payment> = {
        id: 'pay-1',
        userId: 'user-1',
        amount: 100,
        currency: 'USD',
      };

      (invoiceRepo.query as jest.Mock).mockResolvedValue([]);
      (paymentRepo.findOne as jest.Mock).mockResolvedValue(mockPayment);

      await expect(
        service.generateAndArchiveInvoice(mockPayment as Payment),
      ).rejects.toThrow(/Failed to retrieve sequence value/);
    });
  });

  describe('Concurrency (Unit Mock - Database-Level Guarantee)', () => {
    it('should handle parallel invoice generation requests without collision (mocked)', async () => {
      const mockPayment: Partial<Payment> = {
        id: 'pay-1',
        userId: 'user-1',
        amount: 100,
        currency: 'USD',
      };

      // Mock the sequence to return different values for each call
      // In reality, PostgreSQL nextval() handles this atomically
      let callCount = 0;
      (invoiceRepo.query as jest.Mock).mockImplementation(async () => {
        callCount++;
        const seqNum = String(callCount).padStart(6, '0');
        return [{ seq_value: seqNum }];
      });

      (invoiceRepo.create as jest.Mock).mockImplementation((data) => ({
        id: `inv-${callCount}`,
        ...data,
      }));

      (invoiceRepo.save as jest.Mock).mockImplementation(async (invoice) => invoice);
      (paymentRepo.findOne as jest.Mock).mockResolvedValue(mockPayment);

      // Simulate 10 concurrent invoice generation calls
      const promises = Array.from({ length: 10 }, () =>
        service.generateAndArchiveInvoice(mockPayment as Payment),
      );

      const results = await Promise.all(promises);

      // All invoice numbers should be unique
      const invoiceNumbers = results.map((inv) => inv.invoiceNumber);
      const uniqueNumbers = new Set(invoiceNumbers);

      expect(uniqueNumbers.size).toBe(10);
      expect(invoiceNumbers).toEqual(expect.arrayContaining([
        'INV-000001',
        'INV-000002',
        'INV-000003',
        'INV-000004',
        'INV-000005',
        'INV-000006',
        'INV-000007',
        'INV-000008',
        'INV-000009',
        'INV-000010',
      ]));
    });

    it('should generate monotonically increasing invoice numbers', async () => {
      const mockPayment: Partial<Payment> = {
        id: 'pay-1',
        userId: 'user-1',
        amount: 100,
        currency: 'USD',
      };

      let seqCounter = 1;
      (invoiceRepo.query as jest.Mock).mockImplementation(async () => {
        const val = String(seqCounter).padStart(6, '0');
        seqCounter++;
        return [{ seq_value: val }];
      });

      (invoiceRepo.create as jest.Mock).mockImplementation((data) => ({
        ...data,
      }));

      (invoiceRepo.save as jest.Mock).mockImplementation(async (invoice) => invoice);
      (paymentRepo.findOne as jest.Mock).mockResolvedValue(mockPayment);

      const inv1 = await service.generateAndArchiveInvoice(mockPayment as Payment);
      const inv2 = await service.generateAndArchiveInvoice(mockPayment as Payment);
      const inv3 = await service.generateAndArchiveInvoice(mockPayment as Payment);

      // Extract sequence numbers and verify ordering
      const getSeqNum = (invoiceNumber: string) => parseInt(invoiceNumber.split('-')[1], 10);

      expect(getSeqNum(inv1.invoiceNumber)).toBe(1);
      expect(getSeqNum(inv2.invoiceNumber)).toBe(2);
      expect(getSeqNum(inv3.invoiceNumber)).toBe(3);
    });
  });

  describe('Archived HTML File Naming', () => {
    it('should derive archived filename from invoiceNumber (coupling preserved)', async () => {
      const mockPayment: Partial<Payment> = {
        id: 'pay-1',
        userId: 'user-1',
        amount: 100,
        currency: 'USD',
      };

      const mockInvoice: Partial<Invoice> = {
        id: 'inv-1',
        invoiceNumber: 'INV-000001',
        amount: 100,
        totalAmount: 100,
        currency: 'USD',
        status: InvoiceStatus.PAID,
        issuedDate: new Date(),
        items: [],
      };

      (invoiceRepo.query as jest.Mock).mockResolvedValue([{ seq_value: '000001' }]);
      (invoiceRepo.create as jest.Mock).mockReturnValue(mockInvoice);
      (invoiceRepo.save as jest.Mock).mockResolvedValue(mockInvoice);
      (paymentRepo.findOne as jest.Mock).mockResolvedValue(mockPayment);

      const result = await service.generateAndArchiveInvoice(mockPayment as Payment);

      // Verify the fileUrl contains the invoiceNumber
      expect(result.fileUrl).toContain('INV-000001.html');
      expect(result.fileUrl).toContain('archived_invoices');
    });
  });

  describe('Error Handling', () => {
    it('should distinguish between unique violations and other DB errors', async () => {
      const mockPayment: Partial<Payment> = {
        id: 'pay-1',
        userId: 'user-1',
        amount: 100,
        currency: 'USD',
      };

      const mockInvoice: Partial<Invoice> = {
        invoiceNumber: 'INV-000001',
      };

      // Non-unique error (e.g., connection failure)
      const connectionError = new Error('Connection refused') as any;
      connectionError.code = '08P01'; // PostgreSQL connection error

      (invoiceRepo.query as jest.Mock).mockResolvedValue([{ seq_value: '000001' }]);
      (invoiceRepo.create as jest.Mock).mockReturnValue(mockInvoice);
      (invoiceRepo.save as jest.Mock).mockRejectedValue(connectionError);
      (paymentRepo.findOne as jest.Mock).mockResolvedValue(mockPayment);

      // Should NOT throw ConflictException; should re-throw original error
      await expect(
        service.generateAndArchiveInvoice(mockPayment as Payment),
      ).rejects.toThrow(Error);

      await expect(
        service.generateAndArchiveInvoice(mockPayment as Payment),
      ).rejects.not.toThrow(ConflictException);
    });
  });
});
