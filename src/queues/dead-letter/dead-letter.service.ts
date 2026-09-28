import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { QUEUE_NAMES } from '../../common/constants/queue.constants';

export interface DeadLetterJobData {
  originalQueue: string;
  originalJobId: string | number;
  originalJobName: string;
  originalData: any;
  failedReason: string;
  failedAt: string;
  attemptsMade: number;
  stackTrace?: string;
}

@Injectable()
export class DeadLetterService {
  private readonly logger = new Logger(DeadLetterService.name);

  constructor(@InjectQueue(QUEUE_NAMES.DEAD_LETTER) private readonly deadLetterQueue: Queue) {}

  async sendToDeadLetter(job: Job, queueName: string): Promise<void> {
    const data: DeadLetterJobData = {
      originalQueue: queueName,
      originalJobId: job.id,
      originalJobName: job.name,
      originalData: job.data,
      failedReason: job.failedReason ?? 'Unknown error',
      failedAt: new Date().toISOString(),
      attemptsMade: job.attemptsMade,
      stackTrace: job.stacktrace?.[0],
    };

    await this.deadLetterQueue.add(`${queueName}:${job.name || 'unknown'}`, data, {
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: true,
    });

    this.logger.warn(
      `[DEAD-LETTER] Job ${job.id} from "${queueName}" moved to dead-letter queue (reason: ${data.failedReason})`,
    );
  }
}
