import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { RetryLogicService } from '../retry/retry-logic.service';

/**
 * Default Queue Processor
 * Processes jobs from the default queue
 */
@Processor('default')
export class DefaultQueueProcessor {
  private readonly logger = new Logger(DefaultQueueProcessor.name);

  constructor(private readonly retryLogicService: RetryLogicService) {}

  @Process('*')
  async handleJob(job: Job): Promise<any> {
    this.logger.log(
      `Processing job ${job.name} (ID: ${job.id}) - Attempt ${job.attemptsMade + 1}`,
    );

    try {
      // Update progress
      await job.progress(10);

      // Simulate job processing based on job name
      const result = await this.processJobByType(job);

      await job.progress(100);
      return result;
    } catch (error) {
      this.logger.error(
        `Error processing job ${job.id}:`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Process job based on its type/name
   */
  private async processJobByType(job: Job): Promise<any> {
    switch (job.name) {
      case 'send-email':
        return this.processSendEmail(job);
      case 'generate-report':
        return this.processGenerateReport(job);
      case 'process-payment':
        return this.processPayment(job);
      case 'backup-data':
        return this.processBackup(job);
      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
        return { status: 'completed', message: 'Job processed' };
    }
  }

  private async processSendEmail(job: Job): Promise<any> {
    await job.progress(30);
    // Email sending logic here
    this.logger.log(`Sending email to ${job.data.to}`);
    await this.simulateWork(2000);
    await job.progress(80);
    return { status: 'sent', recipient: job.data.to };
  }

  private async processGenerateReport(job: Job): Promise<any> {
    await job.progress(20);
    this.logger.log(`Generating report: ${job.data.reportType}`);
    await this.simulateWork(5000);
    await job.progress(90);
    return { status: 'generated', reportId: `report-${Date.now()}` };
  }

  private async processPayment(job: Job): Promise<any> {
    await job.progress(40);
    this.logger.log(`Processing payment: ${job.data.amount}`);
    await this.simulateWork(3000);
    await job.progress(95);
    return { status: 'processed', transactionId: `txn-${Date.now()}` };
  }

  private async processBackup(job: Job): Promise<any> {
    await job.progress(25);
    this.logger.log(`Backing up data: ${job.data.dataType}`);
    await this.simulateWork(10000);
    await job.progress(90);
    return { status: 'backed-up', backupId: `backup-${Date.now()}` };
  }

  private simulateWork(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(
      `Job ${job.name} (${job.id}) started processing - Priority: ${job.opts.priority}`,
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    const processingTime = job.finishedOn! - job.processedOn!;
    this.logger.log(
      `Job ${job.name} (${job.id}) completed in ${processingTime}ms - Result: ${JSON.stringify(result)}`,
    );
  }

  @OnQueueFailed()
  async onFailed(job: Job, error: Error) {
    const strategy = this.retryLogicService.getDefaultStrategy(job.name);
    const shouldRetry = this.retryLogicService.shouldRetry(
      error,
      job.attemptsMade,
      strategy.maxAttempts,
    );

    if (shouldRetry) {
      const nextDelay = this.retryLogicService.calculateBackoffDelay(
        job.attemptsMade + 1,
        strategy,
      );

      this.retryLogicService.logRetryAttempt(
        job.id.toString(),
        job.name,
        job.attemptsMade,
        error,
        nextDelay,
      );
    } else {
      this.retryLogicService.handleFinalFailure(
        job.id.toString(),
        job.name,
        error,
        job.attemptsMade,
      );
    }
  }
}
