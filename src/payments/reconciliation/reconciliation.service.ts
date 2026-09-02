import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Payment } from '../entities/payment.entity';
import { AuditAction, AuditCategory, AuditSeverity } from '../../audit-log/enums/audit-action.enum';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { areAmountsEqual, toMoneyNumber } from '../utils/money';

export interface PaymentReconciliationMismatch {
  providerTransactionId: string;
  localPaymentId?: string;
  reason: 'missing_in_provider' | 'missing_locally' | 'mismatch';
  issues?: string[];
  details: Record<string, unknown>;
}

export interface PaymentReconciliationReport {
  period: { start: Date; end: Date };
  generatedAt: Date;
  summary: {
    totalLocalPayments: number;
    totalProviderTransactions: number;
    missingInProvider: number;
    missingLocally: number;
    mismatches: number;
  };
  mismatches: PaymentReconciliationMismatch[];
}

@Injectable()
export class PaymentReconciliationJob {
  private readonly logger = new Logger(PaymentReconciliationJob.name);
  private lastReport?: PaymentReconciliationReport;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly auditLogService: AuditLogService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM, { timeZone: 'UTC' })
  async handleCron(): Promise<void> {
    const now = new Date();
    const start = new Date(now);
    start.setUTCDate(now.getUTCDate() - 1);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 1);

    await this.runReconciliation(start, end);
  }

  async runReconciliation(start: Date, end: Date): Promise<PaymentReconciliationReport> {
    const localPayments = await this.paymentRepository.find({
      where: {
        createdAt: Between(start, end),
      },
    });

    const providerTransactions = await this.fetchProviderTransactions(start, end);

    const localByProviderId = new Map<string, Payment>();
    for (const payment of localPayments) {
      if (payment.providerPaymentId) {
        localByProviderId.set(payment.providerPaymentId, payment);
      }
    }

    const mismatches: PaymentReconciliationMismatch[] = [];

    const providerTransactionIds = new Set<string>();
    for (const transaction of providerTransactions) {
      const providerId = this.getProviderTransactionId(transaction);
      if (providerId) {
        providerTransactionIds.add(providerId);
      }
    }

    for (const payment of localPayments) {
      const providerId = payment.providerPaymentId;
      if (!providerId) {
        continue;
      }
      if (!providerTransactionIds.has(providerId)) {
        const mismatch: PaymentReconciliationMismatch = {
          providerTransactionId: providerId,
          localPaymentId: payment.id,
          reason: 'missing_in_provider',
          details: {
            localStatus: payment.status,
            localAmount: toMoneyNumber(payment.amount),
          },
        };
        mismatches.push(mismatch);
        await this.logMismatch(mismatch, payment);
      }
    }

    for (const transaction of providerTransactions) {
      const providerId = this.getProviderTransactionId(transaction);
      if (!providerId) {
        continue;
      }
      const localPayment = localByProviderId.get(providerId);
      if (!localPayment) {
        const mismatch: PaymentReconciliationMismatch = {
          providerTransactionId: providerId,
          reason: 'missing_locally',
          details: {
            providerStatus: transaction.status,
            providerAmount: toMoneyNumber(transaction.amount),
          },
        };
        mismatches.push(mismatch);
        await this.logMismatch(mismatch);
        continue;
      }

      const issues: string[] = [];
      const localAmount = toMoneyNumber(localPayment.amount);
      const providerAmount = toMoneyNumber(transaction.amount);
      if (!areAmountsEqual(localPayment.amount, transaction.amount)) {
        issues.push('amount');
      }
      const normalizedLocalStatus = this.normalizeStatus(localPayment.status);
      const normalizedProviderStatus = this.normalizeStatus(transaction.status);
      if (normalizedLocalStatus !== normalizedProviderStatus) {
        issues.push('status');
      }

      if (issues.length > 0) {
        const mismatch: PaymentReconciliationMismatch = {
          providerTransactionId: providerId,
          localPaymentId: localPayment.id,
          reason: 'mismatch',
          issues,
          details: {
            localAmount,
            providerAmount,
            localStatus: normalizedLocalStatus,
            providerStatus: normalizedProviderStatus,
          },
        };
        mismatches.push(mismatch);
        await this.logMismatch(mismatch, localPayment);
      }
    }

    const report: PaymentReconciliationReport = {
      period: { start, end },
      generatedAt: new Date(),
      summary: {
        totalLocalPayments: localPayments.length,
        totalProviderTransactions: providerTransactions.length,
        missingInProvider: mismatches.filter((m) => m.reason === 'missing_in_provider').length,
        missingLocally: mismatches.filter((m) => m.reason === 'missing_locally').length,
        mismatches: mismatches.length,
      },
      mismatches,
    };
    this.lastReport = report;
    return report;
  }

  getLastReport(): PaymentReconciliationReport | undefined {
    return this.lastReport;
  }

  private async fetchProviderTransactions(start: Date, end: Date): Promise<any[]> {
    const providerBaseUrl = this.configService.get<string>('PAYMENT_PROVIDER_API_URL');
    if (!providerBaseUrl) {
      return [];
    }

    const response = await firstValueFrom(
      this.httpService.get(`${providerBaseUrl}/transactions`, {
        params: {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        },
      }),
    );

    return Array.isArray(response?.data) ? response.data : [];
  }

  private getProviderTransactionId(transaction: Record<string, any>): string | undefined {
    return transaction.providerTransactionId ?? transaction.transactionId ?? transaction.id;
  }

  private normalizeStatus(status: unknown): string {
    if (typeof status === 'string') {
      const normalized = status.toLowerCase();
      if (normalized === 'succeeded' || normalized === 'completed' || normalized === 'paid') {
        return 'completed';
      }
      if (normalized === 'failed' || normalized === 'canceled' || normalized === 'cancelled') {
        return 'failed';
      }
      return normalized;
    }
    if (typeof status === 'number') {
      return String(status);
    }
    return String(status ?? 'unknown');
  }

  private async logMismatch(
    mismatch: PaymentReconciliationMismatch,
    payment?: Payment,
  ): Promise<void> {
    try {
      await this.auditLogService.log({
        action: AuditAction.PAYMENT_RECONCILIATION_MISMATCH,
        category: AuditCategory.DATA_MODIFICATION,
        severity: AuditSeverity.WARNING,
        entityType: 'payment',
        entityId: payment?.id ?? mismatch.providerTransactionId,
        description: `Payment reconciliation mismatch detected for ${mismatch.providerTransactionId}`,
        metadata: {
          reason: mismatch.reason,
          issues: mismatch.issues ?? [],
          details: mismatch.details,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to log reconciliation mismatch: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
