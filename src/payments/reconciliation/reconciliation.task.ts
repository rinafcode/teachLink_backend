import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ReconciliationService } from './reconciliation.service';

/**
 * Scheduled task for daily payment reconciliation.
 * Runs daily at 02:00 UTC to compare local payments with payment provider transactions.
 */
@Injectable()
export class ReconciliationTask {
  private readonly logger = new Logger(ReconciliationTask.name);

  constructor(private readonly reconciliationService: ReconciliationService) {}

  /**
   * Run daily reconciliation at 02:00 UTC
   * Cron expression: 0 2 * * * (every day at 2:00 AM UTC)
   */
  @Cron('0 2 * * *', {
    timeZone: 'UTC',
  })
  async handleDailyReconciliation(): Promise<void> {
    this.logger.log('Starting daily payment reconciliation job at 02:00 UTC...');
    try {
      const result = await this.reconciliationService.runDailyReconciliation();
      if (result.success) {
        this.logger.log(
          `Daily reconciliation completed successfully. Matched: ${result.report.matchedTransactions}, Unmatched: ${result.report.unmatchedProviderTransactions.length + result.report.unmatchedLocalPayments.length}, Mismatches: ${result.report.mismatches.length}`,
        );
      } else {
        this.logger.error(`Daily reconciliation failed: ${result.error}`);
      }
    } catch (error) {
      this.logger.error('Failed to run daily reconciliation:', error);
    }
  }
}
