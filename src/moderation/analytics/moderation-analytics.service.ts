import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModerationEvent } from './moderation-event.entity';

@Injectable()
export class ModerationAnalyticsService {
  constructor(
    @InjectRepository(ModerationEvent)
    private readonly eventRepo: Repository<ModerationEvent>,
  ) {}

  async logModerationEvent(content: string, score: number, status: string) {
    const event = this.eventRepo.create({ content, score, status });
    await this.eventRepo.save(event);
  }

  async getAnalytics() {
    return this.eventRepo.find({ order: { timestamp: 'DESC' } });
  }
}
