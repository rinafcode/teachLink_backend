import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewItem } from './review-item.entity';

@Injectable()
export class ManualReviewService {
  constructor(
    @InjectRepository(ReviewItem)
    private readonly reviewRepo: Repository<ReviewItem>,
  ) {}

  async enqueue(content: string, safetyScore: number) {
    const item = this.reviewRepo.create({ content, safetyScore, status: 'pending' });
    await this.reviewRepo.save(item);
  }

  async getQueue(): Promise<ReviewItem[]> {
    return this.reviewRepo.find({
      where: { status: 'pending' },
      order: { safetyScore: 'DESC', createdAt: 'ASC' }, // prioritize high risk, then oldest
    });
  }

  async markReviewed(id: number) {
    await this.reviewRepo.update(id, { status: 'reviewed' });
  }
}
