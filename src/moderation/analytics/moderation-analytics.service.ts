import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModerationEvent } from './moderation-event.entity';

/**
 * Provides moderation Analytics operations.
 */
@Injectable()
export class ModerationAnalyticsService {
    constructor(
    @InjectRepository(ModerationEvent)
    private readonly eventRepo: Repository<ModerationEvent>,
  ) {}

  /**
   * Executes log Moderation Event.
   * @param content The content.
   * @param score The score.
   * @param status The status value.
   * @returns The operation result.
   */
  async logModerationEvent(content: string, score: number, status: string) {
    const event = this.eventRepo.create({ content, score, status });
    await this.eventRepo.save(event);
  }

  /**
   * Retrieves analytics.
   * @returns The operation result.
   */
  async getAnalytics() {
    return this.eventRepo.find({ order: { timestamp: 'DESC' } });
  }
}
