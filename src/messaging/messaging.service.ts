import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { TracingService } from './tracing/tracing.service';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    @InjectQueue('message-queue')
    private readonly messageQueue: Queue,
    private readonly tracingService: TracingService,
  ) {}

  async addMessageToQueue(data: any, options?: any): Promise<Job<any>> {
    const span = this.tracingService.startSpan('add-message-to-queue');
    try {
      const job = await this.messageQueue.add(data, options);
      this.logger.log(`Message added to queue: ${job.id}`);
      return job;
    } catch (error) {
      this.logger.error('Failed to add message to queue', error);
      throw error;
    } finally {
      this.tracingService.endSpan(span);
    }
  }

  async processMessages(): Promise<void> {
    this.messageQueue.process(async (job: Job) => {
      const span = this.tracingService.startSpan('process-message');
      try {
        this.logger.log(`Processing message: ${job.id}`);
        // Process the message here
        // This would typically emit events or call other services
        await this.handleMessage(job.data);
      } catch (error) {
        this.logger.error(`Failed to process message ${job.id}`, error);
        throw error;
      } finally {
        this.tracingService.endSpan(span);
      }
    });
  }

  private async handleMessage(data: any): Promise<void> {
    // Implement message handling logic
    this.logger.log('Handling message:', data);
  }

  async getQueueStatus(): Promise<any> {
    const waiting = await this.messageQueue.getWaiting();
    const active = await this.messageQueue.getActive();
    const completed = await this.messageQueue.getCompleted();
    const failed = await this.messageQueue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    };
  }
}
