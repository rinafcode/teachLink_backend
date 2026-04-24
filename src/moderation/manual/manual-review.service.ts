import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewItem } from './review-item.entity';

/**
 * Provides manual Review operations.
 */
@Injectable()
export class ManualReviewService {
  constructor(
    @InjectRepository(ReviewItem)
    private readonly reviewRepo: Repository<ReviewItem>,
  ) {}

  /**
   * Executes enqueue.
   * @param content The content.
   * @param safetyScore The safety score.
   * @returns The operation result.
   */
  async enqueue(content: string, safetyScore: number) {
    const item = this.reviewRepo.create({ content, safetyScore, status: 'pending' });
    await this.reviewRepo.save(item);
  }

  /**
   * Retrieves queue.
   * @returns The matching results.
   */
  async getQueue(): Promise<ReviewItem[]> {
    return this.reviewRepo.find({
      where: { status: 'pending' },
      order: { safetyScore: 'DESC', createdAt: 'ASC' }, // prioritize high risk, then oldest
    });
  }

  /**
   * Marks reviewed.
   * @param id The identifier.
   * @returns The operation result.
   */
  async markReviewed(id: number) {
    await this.reviewRepo.update(id, { status: 'reviewed' });
  }
}
