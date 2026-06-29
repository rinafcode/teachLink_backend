import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job, JobOptions as BullJobOptions } from 'bull';
import { QUEUE_NAMES } from '../common/constants/queue.constants';
import { JobPriority } from './enums/job-priority.enum';
import { IJobOptions } from './interfaces/queue.interfaces';
import { PrioritizationService } from './prioritization/prioritization.service';
import { RetryStrategyService, RetryStrategyKey } from './retry/retry-strategy.service';

export interface AddJobResult {
  jobId: string | number;
  queue: string;
  name: string;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.EMAIL) private readonly emailQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EMAIL_MARKETING) private readonly emailMarketingQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SYNC_TASKS) private readonly syncTasksQueue: Queue,
    @InjectQueue(QUEUE_NAMES.BACKUP_PROCESSING) private readonly backupProcessingQueue: Queue,
    @InjectQueue(QUEUE_NAMES.MESSAGE_QUEUE) private readonly messageQueue: Queue,
    @InjectQueue(QUEUE_NAMES.MEDIA_PROCESSING) private readonly mediaProcessingQueue: Queue,
    @InjectQueue(QUEUE_NAMES.DEFAULT) private readonly defaultQueue: Queue,
    @InjectQueue(QUEUE_NAMES.USER_DATA_EXPORT) private readonly userDataExportQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SUBSCRIPTIONS) private readonly subscriptionsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.WEBHOOKS) private readonly webhooksQueue: Queue,
    @InjectQueue(QUEUE_NAMES.DEAD_LETTER) private readonly deadLetterQueue: Queue,
    private readonly prioritizationService: PrioritizationService,
    private readonly retryStrategyService: RetryStrategyService,
  ) {}

  private readonly queueMap = new Map<string, Queue>();

  private getQueue(queueName: string): Queue {
    let queue = this.queueMap.get(queueName);
    if (!queue) {
      const map: Record<string, Queue> = {
        [QUEUE_NAMES.EMAIL]: this.emailQueue,
        [QUEUE_NAMES.EMAIL_MARKETING]: this.emailMarketingQueue,
        [QUEUE_NAMES.SYNC_TASKS]: this.syncTasksQueue,
        [QUEUE_NAMES.BACKUP_PROCESSING]: this.backupProcessingQueue,
        [QUEUE_NAMES.MESSAGE_QUEUE]: this.messageQueue,
        [QUEUE_NAMES.MEDIA_PROCESSING]: this.mediaProcessingQueue,
        [QUEUE_NAMES.DEFAULT]: this.defaultQueue,
        [QUEUE_NAMES.USER_DATA_EXPORT]: this.userDataExportQueue,
        [QUEUE_NAMES.SUBSCRIPTIONS]: this.subscriptionsQueue,
        [QUEUE_NAMES.WEBHOOKS]: this.webhooksQueue,
        [QUEUE_NAMES.DEAD_LETTER]: this.deadLetterQueue,
      };
      queue = map[queueName];
      if (!queue) {
        throw new NotFoundException(`Queue "${queueName}" not found`);
      }
      this.queueMap.set(queueName, queue);
    }
    return queue;
  }

  async addJob(
    queueName: string,
    jobName: string,
    data: Record<string, any>,
    options?: Partial<IJobOptions>,
    retryStrategy?: RetryStrategyKey,
  ): Promise<AddJobResult> {
    const queue = this.getQueue(queueName);
    const priorityLevel = options?.priority ?? JobPriority.NORMAL;
    const bullPriority = this.prioritizationService.toBullPriority(priorityLevel);

    const { priority: _, ...restOptions } = options ?? {};

    let retryOpts: Record<string, any> = {};
    if (retryStrategy) {
      retryOpts = {
        attempts: this.retryStrategyService.getBullAttempts(retryStrategy),
        backoff: this.retryStrategyService.getBullBackoff(retryStrategy),
      };
    }

    const jobOptions: BullJobOptions = {
      ...restOptions,
      ...retryOpts,
      priority: bullPriority,
    };

    const job = await queue.add(jobName, data, jobOptions);
    this.logger.debug(`Job ${job.id} added to "${queueName}" (name: ${jobName})`);
    return { jobId: job.id, queue: queueName, name: jobName };
  }

  async getJob(queueName: string, jobId: string): Promise<Job | null> {
    const queue = this.getQueue(queueName);
    return queue.getJob(jobId);
  }

  async getQueueCounts(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const queue = this.getQueue(queueName);
    const counts = await queue.getJobCounts();
    return counts;
  }
}
