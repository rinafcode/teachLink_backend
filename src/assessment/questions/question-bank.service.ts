import { Question } from '../entities/question.entity';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { clampLimit } from '../../common/utils/pagination.utils';
import { OffsetPaginatedResponse } from '../../common/interfaces/pagination.interface';

/**
 * Provides question Bank operations.
 */
@Injectable()
export class QuestionBankService {
  constructor(
    @InjectRepository(Question)
    private readonly questionRepo: Repository<Question>,
  ) {}
  create(question: Partial<Question>): Promise<Question> {
    return this.questionRepo.save(question);
  }
  findByAssessment(
    assessmentId: string,
    page = 1,
    limit = 10,
  ): Promise<OffsetPaginatedResponse<Question>> {
    const clampedLimit = clampLimit(limit);
    const skip = (page - 1) * clampedLimit;
    return this.questionRepo.findAndCount({
      where: { assessment: { id: assessmentId } },
      order: { createdAt: 'DESC' },
      skip,
      take: clampedLimit,
    }).then(([data, total]) => {
      const totalPages = Math.ceil(total / clampedLimit);
      return {
        data,
        total,
        page,
        limit: clampedLimit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      };
    });
  }
}
