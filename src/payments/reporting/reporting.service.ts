import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import { Refund, RefundStatus } from '../entities/refund.entity';
import { Invoice, InvoiceStatus } from '../entities/invoice.entity';

@Injectable()
export class ReportingService {
  private readonly logger = new Logger(ReportingService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Refund)
    private readonly refundRepository: Repository<Refund>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
  ) {}

  async generateDailyReconciliationReport(date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const payments = await this.paymentRepository.find({
      where: {
        createdAt: Between(startOfDay, endOfDay),
        status: PaymentStatus.COMPLETED,
      },
    });

    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalTransactions = payments.length;

    return {
      date: startOfDay.toISOString().split('T')[0],
      totalTransactions,
      totalRevenue,
      currency: 'USD',
      transactions: payments.map(p => ({
        id: p.id,
        amount: p.amount,
        provider: p.provider,
        providerPaymentId: p.providerPaymentId,
      })),
    };
  }

  async generateRefundReport(startDate: Date, endDate: Date) {
    const refunds = await this.refundRepository.find({
      where: {
        createdAt: Between(startDate, endDate),
        status: RefundStatus.PROCESSED,
      },
      relations: ['payment'],
    });

    const totalRefunded = refunds.reduce((sum, r) => sum + Number(r.amount), 0);
    const refundCount = refunds.length;

    return {
      period: { startDate, endDate },
      totalRefunded,
      refundCount,
      currency: 'USD',
      refunds: refunds.map(r => ({
        id: r.id,
        paymentId: r.paymentId,
        amount: r.amount,
        reason: r.reason,
        refundMethod: r.refundMethod,
      })),
    };
  }

  async generateRevenueRecognitionReport(startDate: Date, endDate: Date) {
    const payments = await this.paymentRepository.find({
      where: {
        createdAt: Between(startDate, endDate),
        status: PaymentStatus.COMPLETED,
      },
    });

    const refunds = await this.refundRepository.find({
      where: {
        createdAt: Between(startDate, endDate),
        status: RefundStatus.PROCESSED,
      },
    });

    const grossRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalRefunds = refunds.reduce((sum, r) => sum + Number(r.amount), 0);
    const netRevenue = grossRevenue - totalRefunds;

    const subscriptionRevenue = payments
      .filter(p => p.isSubscription)
      .reduce((sum, p) => sum + Number(p.amount), 0);
      
    const oneOffRevenue = grossRevenue - subscriptionRevenue;

    return {
      period: { startDate, endDate },
      grossRevenue,
      totalRefunds,
      netRevenue,
      breakdown: {
        subscriptionRevenue,
        oneOffRevenue,
      },
      currency: 'USD',
    };
  }

  async generateTaxReport(startDate: Date, endDate: Date) {
    const invoices = await this.invoiceRepository.find({
      where: {
        issuedDate: Between(startDate, endDate),
        status: In([InvoiceStatus.PAID, InvoiceStatus.SENT]),
      },
    });

    const totalTaxableAmount = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
    const totalTaxCollected = invoices.reduce((sum, inv) => sum + Number(inv.taxAmount), 0);

    return {
      period: { startDate, endDate },
      totalInvoices: invoices.length,
      totalTaxableAmount,
      totalTaxCollected,
      currency: 'USD',
    };
  }
}
