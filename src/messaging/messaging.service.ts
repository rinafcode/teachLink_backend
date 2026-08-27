import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateMessageDto } from './message.dto';
import { Message } from './message.entity';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { QUEUE_NAMES } from '../common/constants/queue.constants';
import { TracingService } from './tracing/tracing.service';
import { enrichWithCorrelation } from '../queues/utils/correlation-job.util';
import { PaginationService } from '../common/services/pagination.service';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { clampLimit } from '../common/utils/pagination.utils';

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
    private readonly paginationService: PaginationService,
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
      // Add to queue for async processing if needed.
      // Enrich payload with the active correlation ID so the worker can
      // restore the originating request's tracing context (#829).
      await this.messageQueue.add(enrichWithCorrelation({ ...saved }));
      return saved;
    } catch (error) {
      this.logger.error('Failed to create message', error);
      throw error;
    } finally {
      this.tracingService.endSpan(span);
    }
  }

  async getConversation(
    userId: string,
    otherUserId: string,
    query?: PaginationQueryDto,
  ): Promise<any> {
    const span = this.tracingService.startSpan('get-conversation');
    try {
      const limit = clampLimit(query?.limit);
      const offset =
        query?.offset ??
        (query?.cursor ? undefined : ((query?.page ?? 1) - 1) * limit);
      const qb = this.messageRepo
        .createQueryBuilder('message')
        .where(
          '(message.senderId = :userId AND message.recipientId = :otherUserId) OR (message.senderId = :otherUserId AND message.recipientId = :userId)',
          { userId, otherUserId },
        );

      return this.paginationService.paginate(qb, query?.cursor, limit, offset, 'createdAt');
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
