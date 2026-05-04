import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { QUEUE_NAMES } from '../../common/constants/queue.constants';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { RetryLogicService } from '../retry/retry-logic.service';
import { sanitizeEmail, sanitizePii } from '../../common/utils/pii-sanitizer.utils';
import { WorkerOrchestrationService } from '../../workers/orchestration/worker-orchestration.service';

/**
 * Default Queue Processor
 * Processes jobs from the default queue using Worker Orchestration
 */
@Processor(QUEUE_NAMES.DEFAULT)
export class DefaultQueueProcessor {
  private readonly logger = new Logger(DefaultQueueProcessor.name);

  constructor(
    private readonly retryLogicService: RetryLogicService,
    private readonly workerOrchestration: WorkerOrchestrationService,
  ) {}

  /**
   * Handles job.
   * @param job The job.
   * @returns The operation result.
   */
  @Process('*')
  async handleJob(job: Job): Promise<any> {
    this.logger.log(`Processing job ${job.name} (ID: ${job.id}) - Attempt ${job.attemptsMade + 1}`);

    try {
      // Route job to appropriate worker
      const workerResult = await this.workerOrchestration.routeJob(job);

      this.logger.log(
        `Job ${job.name} (${job.id}) processed by worker ${workerResult.workerId} in ${workerResult.executionTime}ms`,
      );

      return workerResult;
    } catch (error) {
      this.logger.error(`Error processing job ${job.id}:`, error.message);
      throw error;
    }
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(
      `Job ${job.name} (${job.id}) started processing - Priority: ${job.opts.priority}`,
    );
  }

  /**
   * Executes on Completed.
   * @param job The job.
   * @param result The result.
   * @returns The operation result.
   */
  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    const processingTime = (job.finishedOn ?? Date.now()) - (job.processedOn ?? Date.now());
    this.logger.log(
      `Job ${job.name} (${job.id}) completed in ${processingTime}ms - Result: ${JSON.stringify(
        sanitizePii(result),
      )}`,
    );
  }

  /**
   * Executes on Failed.
   * @param job The job.
   * @param error The error.
   * @returns The operation result.
   */
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
