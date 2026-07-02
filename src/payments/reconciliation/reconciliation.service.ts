import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AuditAction, AuditSeverity, AuditCategory } from '../../audit-log/enums/audit-action.enum';

export interface ProviderTransaction {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface ReconciliationReport {
  runAt: Date;
  startDate: Date;
  endDate: Date;
  totalProviderTransactions: number;
  totalLocalPayments: number;
  matchedTransactions: number;
  unmatchedProviderTransactions: ProviderTransaction[];
  unmatchedLocalPayments: Payment[];
  mismatches: Array<{
    type: 'amount_mismatch' | 'status_mismatch' | 'currency_mismatch';
    providerTransaction: ProviderTransaction;
    localPayment: Payment;
    details: string;
  }>;
}

export interface ReconciliationResult {
  success: boolean;
  report: ReconciliationReport;
  error?: string;
}

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);
  private lastReport: ReconciliationReport | null = null;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Run reconciliation for the previous day
   */
  async runDailyReconciliation(): Promise<ReconciliationResult> {
    this.logger.log('Starting daily payment reconciliation...');

    const endDate = new Date();
    endDate.setUTCHours(0, 0, 0, 0);
    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - 1);

    try {
      const report = await this.reconcileDateRange(startDate, endDate);
      this.lastReport = report;

      // Log summary to audit log
      await this.auditLogService.log({
        action: AuditAction.REPORT_GENERATED,
        userId: null,
        userEmail: null,
        entityType: 'PaymentReconciliation',
        entityId: report.runAt.toISOString(),
        ipAddress: 'system',
        userAgent: 'reconciliation-service',
        metadata: {
          reconciliationType: 'daily',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          totalProviderTransactions: report.totalProviderTransactions,
          totalLocalPayments: report.totalLocalPayments,
          matchedTransactions: report.matchedTransactions,
          unmatchedCount:
            report.unmatchedProviderTransactions.length + report.unmatchedLocalPayments.length,
          mismatchCount: report.mismatches.length,
        },
        severity: report.mismatches.length > 0 ? AuditSeverity.WARNING : AuditSeverity.INFO,
        category: AuditCategory.COMPLIANCE,
      });

      // Log individual mismatches
      for (const mismatch of report.mismatches) {
        await this.auditLogService.log({
          action: AuditAction.PAYMENT_RECONCILIATION_MISMATCH,
          userId: null,
          userEmail: null,
          entityType: 'Payment',
          entityId: mismatch.localPayment.id,
          ipAddress: 'system',
          userAgent: 'reconciliation-service',
          metadata: {
            mismatchType: mismatch.type,
            providerTransactionId: mismatch.providerTransaction.id,
            localPaymentId: mismatch.localPayment.id,
            providerAmount: mismatch.providerTransaction.amount,
            localAmount: mismatch.localPayment.amount,
            providerStatus: mismatch.providerTransaction.status,
            localStatus: mismatch.localPayment.status,
            providerCurrency: mismatch.providerTransaction.currency,
            localCurrency: mismatch.localPayment.currency,
            details: mismatch.details,
          },
          severity: AuditSeverity.ERROR,
          category: AuditCategory.COMPLIANCE,
        });
      }

      this.logger.log(
        `Reconciliation completed. Matched: ${report.matchedTransactions}, Unmatched: ${report.unmatchedProviderTransactions.length + report.unmatchedLocalPayments.length}, Mismatches: ${report.mismatches.length}`,
      );

      return { success: true, report };
    } catch (error) {
      this.logger.error('Reconciliation failed:', error);
      return {
        success: false,
        report: {
          runAt: new Date(),
          startDate,
          endDate,
          totalProviderTransactions: 0,
          totalLocalPayments: 0,
          matchedTransactions: 0,
          unmatchedProviderTransactions: [],
          unmatchedLocalPayments: [],
          mismatches: [],
        },
        error: error.message,
      };
    }
  }

  /**
   * Reconcile payments for a specific date range
   */
  private async reconcileDateRange(startDate: Date, endDate: Date): Promise<ReconciliationReport> {
    // Fetch transactions from payment provider (mock implementation)
    const providerTransactions = await this.fetchProviderTransactions(startDate, endDate);

    // Fetch local payments for the same period
    const localPayments = await this.paymentRepository.find({
      where: {
        createdAt: {
          $gte: startDate,
          $lt: endDate,
        } as any,
      },
    });

    // Compare transactions
    const matchedIds = new Set<string>();
    const unmatchedProviderTransactions: ProviderTransaction[] = [];
    const unmatchedLocalPayments: Payment[] = [];
    const mismatches: ReconciliationReport['mismatches'] = [];

    // Build a map of local payments by provider transaction ID
    const localPaymentsByProviderId = new Map<string, Payment>();
    for (const payment of localPayments) {
      if (payment.providerPaymentId) {
        localPaymentsByProviderId.set(payment.providerPaymentId, payment);
      }
    }

    // Check each provider transaction
    for (const providerTx of providerTransactions) {
      const localPayment = localPaymentsByProviderId.get(providerTx.id);

      if (!localPayment) {
        unmatchedProviderTransactions.push(providerTx);
        continue;
      }

      matchedIds.add(providerTx.id);

      // Check for mismatches
      const mismatch = this.detectMismatch(providerTx, localPayment);
      if (mismatch) {
        mismatches.push(mismatch);
      }
    }

    // Find local payments without matching provider transactions
    for (const payment of localPayments) {
      if (payment.providerPaymentId && !matchedIds.has(payment.providerPaymentId)) {
        unmatchedLocalPayments.push(payment);
      }
    }

    return {
      runAt: new Date(),
      startDate,
      endDate,
      totalProviderTransactions: providerTransactions.length,
      totalLocalPayments: localPayments.length,
      matchedTransactions: matchedIds.size,
      unmatchedProviderTransactions,
      unmatchedLocalPayments,
      mismatches,
    };
  }

  /**
   * Fetch transactions from payment provider for the given date range
   * This is a mock implementation - in production, this would call the actual provider API (Stripe, PayPal, etc.)
   */
  private async fetchProviderTransactions(
    _startDate: Date,
    _endDate: Date,
  ): Promise<ProviderTransaction[]> {
    // TODO: Implement actual provider API call
    // For now, return empty array as this needs to be integrated with the actual payment provider
    // Example implementation for Stripe:
    // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    // const charges = await stripe.charges.list({
    //   created: { gte: Math.floor(startDate.getTime() / 1000), lt: Math.floor(endDate.getTime() / 1000) },
    //   limit: 100,
    // });
    // return charges.data.map(charge => ({
    //   id: charge.id,
    //   amount: charge.amount / 100,
    //   currency: charge.currency.toUpperCase(),
    //   status: charge.status,
    //   createdAt: new Date(charge.created * 1000),
    //   metadata: charge.metadata,
    // }));

    this.logger.warn(
      'Provider transaction fetch not implemented - using mock implementation. Integrate with actual payment provider API.',
    );
    return [];
  }

  /**
   * Detect mismatches between provider transaction and local payment
   */
  private detectMismatch(
    providerTx: ProviderTransaction,
    localPayment: Payment,
  ): ReconciliationReport['mismatches'][0] | null {
    // Check amount mismatch
    if (Math.abs(providerTx.amount - Number(localPayment.amount)) > 0.01) {
      return {
        type: 'amount_mismatch',
        providerTransaction: providerTx,
        localPayment,
        details: `Amount mismatch: provider=${providerTx.amount}, local=${localPayment.amount}`,
      };
    }

    // Check currency mismatch
    if (providerTx.currency !== localPayment.currency) {
      return {
        type: 'currency_mismatch',
        providerTransaction: providerTx,
        localPayment,
        details: `Currency mismatch: provider=${providerTx.currency}, local=${localPayment.currency}`,
      };
    }

    // Check status mismatch (mapping provider status to local status)
    const statusMap: Record<string, string> = {
      succeeded: 'completed',
      pending: 'pending',
      failed: 'failed',
      refunded: 'refunded',
    };
    const expectedLocalStatus = statusMap[providerTx.status] || providerTx.status;
    if (expectedLocalStatus !== localPayment.status) {
      return {
        type: 'status_mismatch',
        providerTransaction: providerTx,
        localPayment,
        details: `Status mismatch: provider=${providerTx.status}, local=${localPayment.status}`,
      };
    }

    return null;
  }

  /**
   * Get the last reconciliation report
   */
  getLastReport(): ReconciliationReport | null {
    return this.lastReport;
  }
}
