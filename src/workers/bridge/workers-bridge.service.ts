import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { QUEUE_NAMES } from '../../common/constants/queue.constants';
import { EmailWorker } from '../processors/email.worker';
import { MediaProcessingWorker } from '../processors/media-processing.worker';
import { DataSyncWorker } from '../processors/data-sync.worker';
import { BackupProcessingWorker } from '../processors/backup-processing.worker';
import { WebhooksWorker } from '../processors/webhooks.worker';
import { SubscriptionsWorker } from '../processors/subscriptions.worker';
import { MetricsCollectionService } from '../../monitoring/metrics/metrics-collection.service';
import { DeadLetterService } from '../../queues/dead-letter/dead-letter.service';
import { MessagingService } from '../../messaging/messaging.service';

interface QueueWorkerBinding {
  queue: Queue;
  handler: (job: Job) => Promise<any>;
  concurrency: number;
  name: string;
}

@Injectable()
export class WorkersBridgeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkersBridgeService.name);
  private readonly bindings: QueueWorkerBinding[] = [];

  constructor(
    @InjectQueue(QUEUE_NAMES.EMAIL) private readonly emailQueue: Queue,
    @InjectQueue(QUEUE_NAMES.MEDIA_PROCESSING) private readonly mediaQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SYNC_TASKS) private readonly syncQueue: Queue,
    @InjectQueue(QUEUE_NAMES.BACKUP_PROCESSING) private readonly backupQueue: Queue,
    @InjectQueue(QUEUE_NAMES.WEBHOOKS) private readonly webhooksQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SUBSCRIPTIONS) private readonly subscriptionsQueue: Queue,
    private readonly emailWorker: EmailWorker,
    private readonly mediaWorker: MediaProcessingWorker,
    private readonly dataSyncWorker: DataSyncWorker,
    private readonly backupWorker: BackupProcessingWorker,
    private readonly webhooksWorker: WebhooksWorker,
    private readonly subscriptionsWorker: SubscriptionsWorker,
    private readonly metrics?: MetricsCollectionService,
    private readonly deadLetterService?: DeadLetterService,
    private readonly messagingService?: MessagingService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.registerBinding(
      this.emailQueue,
      (job) => this.emailWorker.handle(job),
      this.getConcurrency('email', 5),
      'email',
    );
    this.registerBinding(
      this.mediaQueue,
      (job) => this.mediaWorker.handle(job),
      this.getConcurrency('media', 3),
      'media-processing',
    );
    this.registerBinding(
      this.syncQueue,
      (job) => this.dataSyncWorker.handle(job),
      this.getConcurrency('sync', 4),
      'sync-tasks',
    );
    this.registerBinding(
      this.backupQueue,
      (job) => this.backupWorker.handle(job),
      this.getConcurrency('backup', 1),
      'backup-processing',
    );
    this.registerBinding(
      this.webhooksQueue,
      (job) => this.webhooksWorker.handle(job),
      this.getConcurrency('webhooks', 10),
      'webhooks',
    );
    this.registerBinding(
      this.subscriptionsQueue,
      (job) => this.subscriptionsWorker.handle(job),
      this.getConcurrency('subscriptions', 5),
      'subscriptions',
    );

    if (this.messagingService) {
      await this.messagingService.processMessages();
      this.logger.log('Messaging queue processor registered via MessagingService');
    }

    await Promise.all(this.bindings.map((b) => this.startBinding(b)));
    this.registerDeadLetterHandlers();
    this.logger.log(`Workers bridge initialized with ${this.bindings.length} queue bindings`);
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Closing worker queue connections...');
    for (const binding of this.bindings) {
      try {
        await binding.queue.close();
      } catch (err) {
        this.logger.warn(`Error closing queue "${binding.name}": ${err}`);
      }
    }
  }

  private registerBinding(
    queue: Queue,
    handler: (job: Job) => Promise<any>,
    concurrency: number,
    name: string,
  ): void {
    this.bindings.push({ queue, handler, concurrency, name });
  }

  private async startBinding(binding: QueueWorkerBinding): Promise<void> {
    const wrapped = async (job: Job): Promise<any> => {
      const start = Date.now();
      try {
        this.logger.debug(`[${binding.name}] Processing job ${job.id} (${job.name})`);
        return await binding.handler(job);
      } finally {
        const durationMs = Date.now() - start;
        this.metrics?.recordQueueProcessingTime(
          binding.name,
          job.name || 'unknown',
          durationMs / 1000,
        );
        this.logger.debug(`[${binding.name}] Job ${job.id} completed in ${durationMs}ms`);
      }
    };

    binding.queue.process(binding.concurrency, wrapped);
    this.logger.log(`Queue "${binding.name}" bound with concurrency ${binding.concurrency}`);
  }

  private registerDeadLetterHandlers(): void {
    for (const binding of this.bindings) {
      binding.queue.on('failed', async (job: Job, err: Error) => {
        this.logger.warn(`[${binding.name}] Job ${job.id} failed: ${err.message}`);
        if (this.deadLetterService) {
          try {
            await this.deadLetterService.sendToDeadLetter(job, binding.name);
          } catch (dlqErr) {
            this.logger.error(
              `[DEAD-LETTER] Failed to forward job ${job.id} to dead-letter queue: ${dlqErr}`,
            );
          }
        }
      });
    }
  }

  private getConcurrency(key: string, fallback: number): number {
    const envKey = `QUEUE_CONCURRENCY_${key.toUpperCase()}`;
    const val = process.env[envKey];
    if (val !== undefined) {
      const parsed = parseInt(val, 10);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return fallback;
  }
}
