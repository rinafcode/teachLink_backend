import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QUEUE_NAMES } from '../../common/constants/queue.constants';
import { MetricsCollectionService } from '../../monitoring/metrics/metrics-collection.service';

@Injectable()
export class QueueMetricsService {
  private readonly logger = new Logger(QueueMetricsService.name);

  private readonly queueList: { name: string; queue: Queue }[] = [];

  constructor(
    @InjectQueue(QUEUE_NAMES.EMAIL) emailQueue: Queue,
    @InjectQueue(QUEUE_NAMES.EMAIL_MARKETING) emailMarketingQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SYNC_TASKS) syncTasksQueue: Queue,
    @InjectQueue(QUEUE_NAMES.BACKUP_PROCESSING) backupProcessingQueue: Queue,
    @InjectQueue(QUEUE_NAMES.MESSAGE_QUEUE) messageQueue: Queue,
    @InjectQueue(QUEUE_NAMES.MEDIA_PROCESSING) mediaProcessingQueue: Queue,
    @InjectQueue(QUEUE_NAMES.DEFAULT) defaultQueue: Queue,
    @InjectQueue(QUEUE_NAMES.USER_DATA_EXPORT) userDataExportQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SUBSCRIPTIONS) subscriptionsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.WEBHOOKS) webhooksQueue: Queue,
    @InjectQueue(QUEUE_NAMES.DEAD_LETTER) deadLetterQueue: Queue,
    private readonly metrics: MetricsCollectionService,
  ) {
    this.queueList = [
      { name: QUEUE_NAMES.EMAIL, queue: emailQueue },
      { name: QUEUE_NAMES.EMAIL_MARKETING, queue: emailMarketingQueue },
      { name: QUEUE_NAMES.SYNC_TASKS, queue: syncTasksQueue },
      { name: QUEUE_NAMES.BACKUP_PROCESSING, queue: backupProcessingQueue },
      { name: QUEUE_NAMES.MESSAGE_QUEUE, queue: messageQueue },
      { name: QUEUE_NAMES.MEDIA_PROCESSING, queue: mediaProcessingQueue },
      { name: QUEUE_NAMES.DEFAULT, queue: defaultQueue },
      { name: QUEUE_NAMES.USER_DATA_EXPORT, queue: userDataExportQueue },
      { name: QUEUE_NAMES.SUBSCRIPTIONS, queue: subscriptionsQueue },
      { name: QUEUE_NAMES.WEBHOOKS, queue: webhooksQueue },
      { name: QUEUE_NAMES.DEAD_LETTER, queue: deadLetterQueue },
    ];
  }

  @Interval(30_000)
  async recordQueueMetrics(): Promise<void> {
    for (const entry of this.queueList) {
      try {
        const counts = await entry.queue.getJobCounts();
        this.metrics.updateQueueWaitingJobs(entry.name, counts.waiting || 0);
        this.metrics.updateQueueActiveJobs(entry.name, counts.active || 0);
        this.metrics.updateQueueFailedJobs(entry.name, counts.failed || 0);
      } catch (err) {
        this.logger.warn(`Failed to record metrics for queue "${entry.name}": ${err}`);
      }
    }
  }
}
