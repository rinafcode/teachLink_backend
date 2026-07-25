import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateMessageDto } from './message.dto';
import { Message } from './message.entity';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { QUEUE_NAMES } from '../common/constants/queue.constants';
import { TracingService } from './tracing/tracing.service';

/**
 * Provides messaging operations.
 */
@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);
  constructor(
    @InjectQueue(QUEUE_NAMES.MESSAGE_QUEUE)
    private readonly messageQueue: Queue,
    private readonly tracingService: TracingService,
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
  ) {}

  /**
   * Executes add Message To Queue.
   * @param data The data to process.
   * @param options The options.
   * @returns The resulting job<any>.
   */
  async createMessage(dto: CreateMessageDto): Promise<Message> {
    const span = this.tracingService.startSpan('create-message');
    try {
      const message = this.messageRepo.create({
        ...dto,
        readAt: null,
      });
      const saved = await this.messageRepo.save(message);
      // Add to queue for async processing if needed
      await this.messageQueue.add(saved);
      return saved;
    } catch (error) {
      this.logger.error('Failed to create message', error);
      throw error;
    } finally {
      this.tracingService.endSpan(span);
    }
  }

  async getConversation(userId: string, otherUserId: string): Promise<Message[]> {
    const span = this.tracingService.startSpan('get-conversation');
    try {
      return await this.messageRepo.find({
        where: [
          { senderId: userId, recipientId: otherUserId },
          { senderId: otherUserId, recipientId: userId },
        ],
        order: { createdAt: 'ASC' },
      });
    } finally {
      this.tracingService.endSpan(span);
    }
  }

  async markAsRead(messageId: string): Promise<void> {
    const span = this.tracingService.startSpan('mark-as-read');
    try {
      await this.messageRepo.update(messageId, { readAt: new Date() });
    } finally {
      this.tracingService.endSpan(span);
    }
  }

  /**
   * Processes messages.
   */
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

  /**
   * Retrieves queue Status.
   * @returns The operation result.
   */
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
