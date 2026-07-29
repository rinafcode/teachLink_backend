import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import * as fs from 'fs';
import * as path from 'path';
import { Invoice, InvoiceStatus } from '../entities/invoice.entity';
import { Payment } from '../entities/payment.entity';
import { APP_EVENTS } from '../../common/constants/event.constants';

/**
 * PostgreSQL error codes (from PostgreSQL documentation)
 */
enum PostgresErrorCode {
  UNIQUE_VIOLATION = '23505',
  SERIALIZATION_FAILURE = '40001',
}

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);
  private readonly storagePath = path.join(process.cwd(), 'archived_invoices');

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
  }

  @OnEvent(APP_EVENTS.PAYMENT_COMPLETED)
  async handlePaymentCompletedEvent(payload: { paymentId: string }) {
    this.logger.log(`Received PAYMENT_COMPLETED event for payment ${payload.paymentId}`);
    try {
      const payment = await this.paymentRepository.findOne({
        where: { id: payload.paymentId },
        relations: ['user'],
      });

      if (!payment) {
        this.logger.warn(`Payment ${payload.paymentId} not found, skipping invoice generation`);
        return;
      }

      await this.generateAndArchiveInvoice(payment);
    } catch (error) {
      this.logger.error(`Error generating invoice for payment ${payload.paymentId}:`, error.stack);
    }
  }

  /**
   * Generate a unique invoice number from PostgreSQL sequence.
   * 
   * Atomicity guarantee:
   *  - nextval() is atomic at the database level
   *  - Each concurrent call gets a distinct sequence value
   *  - No application-level locking needed
   * 
   * @returns Invoice number formatted as `INV-<6-digit-zero-padded-sequence>`
   * @throws Error if sequence retrieval fails
   */
  private async generateInvoiceNumber(): Promise<string> {
    try {
      const result = await this.invoiceRepository.query(
        `SELECT LPAD(nextval('invoice_number_seq')::text, 6, '0') as seq_value;`,
      );

      if (!result || result.length === 0) {
        throw new Error('Failed to retrieve sequence value from database');
      }

      const sequenceValue = result[0].seq_value;
      return `INV-${sequenceValue}`;
    } catch (error) {
      this.logger.error(
        'Failed to generate invoice number from sequence',
        (error as Error).stack,
      );
      throw new Error(`Invoice number generation failed: ${(error as Error).message}`);
    }
  }

  async generateAndArchiveInvoice(payment: Payment): Promise<Invoice> {
    const invoiceNumber = await this.generateInvoiceNumber();

    const items = [
      {
        description: `Payment for transaction ${payment.id}`,
        amount: Number(payment.amount),
        quantity: 1,
      },
    ];

    let invoice = this.invoiceRepository.create({
      invoiceNumber,
      amount: payment.amount,
      taxAmount: 0,
      totalAmount: payment.amount,
      currency: payment.currency,
      items,
      status: InvoiceStatus.PAID,
      issuedDate: new Date(),
      paymentId: payment.id,
      userId: payment.userId,
    });

    // Attempt to insert with explicit unique-violation handling
    try {
      invoice = await this.invoiceRepository.save(invoice);
    } catch (error) {
      const dbError = error as any;

      // Check for unique constraint violation (PostgreSQL error code 23505)
      if (dbError?.code === PostgresErrorCode.UNIQUE_VIOLATION) {
        const message =
          `Invoice number collision detected: "${invoiceNumber}" is already in use. ` +
          'This should not occur under normal operation (database sequence ensures uniqueness). ' +
          'Possible causes: manual invoice insertion, sequence reset, or data corruption. ' +
          'Action: investigate database state and contact support.';

        this.logger.error(message);
        throw new ConflictException(message);
      }

      // Re-throw other database errors (connection failures, etc.)
      this.logger.error(
        `Unexpected database error during invoice insert: ${dbError?.message}`,
        dbError?.stack,
      );
      throw error;
    }

    // Generate HTML template
    const htmlContent = `
      <html>
        <head><title>Invoice ${invoice.invoiceNumber}</title></head>
        <body>
          <h1>Invoice</h1>
          <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
          <p><strong>Date:</strong> ${invoice.issuedDate.toISOString()}</p>
          <p><strong>Status:</strong> ${invoice.status.toUpperCase()}</p>
          <p><strong>Total Amount:</strong> ${invoice.totalAmount} ${invoice.currency}</p>
          <hr/>
          <h3>Items</h3>
          <ul>
            ${invoice.items.map((i) => `<li>${i.description} - ${i.amount} x ${i.quantity}</li>`).join('')}
          </ul>
        </body>
      </html>
    `;

    // Save to archival storage
    // Note: fileName is still derived from invoiceNumber to maintain the coupling;
    // the unique constraint and sequence ensure the filename will be unique
    const fileName = `${invoice.invoiceNumber}.html`;
    const filePath = path.join(this.storagePath, fileName);
    fs.writeFileSync(filePath, htmlContent, 'utf-8');

    // Update entity with fileUrl
    invoice.fileUrl = filePath;
    await this.invoiceRepository.save(invoice);

    this.logger.log(`Invoice ${invoice.id} generated and archived at ${filePath}`);
    return invoice;
  }

  async getInvoice(id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({ where: { id } });
    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }
    return invoice;
  }

  getInvoiceFilePath(fileUrl: string): string {
    if (!fs.existsSync(fileUrl)) {
      throw new NotFoundException('Invoice file not found in archival storage');
    }
    return fileUrl;
  }
}
