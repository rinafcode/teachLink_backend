import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Enrollment } from '../courses/entities/enrollment.entity';

@Injectable()
export class CollaborativeFilteringService {
  private readonly logger = new Logger(CollaborativeFilteringService.name);

  constructor(
    @InjectRepository(Enrollment)
    private readonly enrollmentRepo: Repository<Enrollment>,
  ) {}

  async getRecommendedCourseIds(
    userId: string,
    excludeCourseIds: Set<string>,
    topN: number,
  ): Promise<Array<{ courseId: string; score: number }>> {
    const targetEnrollments = await this.enrollmentRepo.find({
      select: ['courseId'],
      where: [
        { userId, status: 'active' },
        { userId, status: 'completed' },
      ],
    });

    if (targetEnrollments.length === 0) return [];

    const excludeArray = [...excludeCourseIds];
    const maxNeighbors = Math.max(topN * 3, 50);

    const rows: Array<{ courseId: string; score: number }> = await this.enrollmentRepo.query(
      `
      WITH target_courses AS (
        SELECT course_id FROM enrollment
        WHERE user_id = $1 AND status IN ($2, $3) AND deleted_at IS NULL
      ),
      target_count AS (
        SELECT COUNT(*)::int AS cnt FROM target_courses
      ),
      candidates AS (
        SELECT DISTINCT e.user_id
        FROM enrollment e
        WHERE e.status IN ($2, $3)
          AND e.user_id <> $1
          AND e.deleted_at IS NULL
          AND e.course_id IN (SELECT course_id FROM target_courses)
      ),
      user_stats AS (
        SELECT
          e.user_id,
          COUNT(DISTINCT e.course_id)::int AS other_count,
          COUNT(DISTINCT CASE WHEN tc.course_id IS NOT NULL THEN e.course_id END)::int AS intersection
        FROM enrollment e
        JOIN candidates c ON c.user_id = e.user_id
        LEFT JOIN target_courses tc ON e.course_id = tc.course_id
        WHERE e.status IN ($2, $3) AND e.deleted_at IS NULL
        GROUP BY e.user_id
        HAVING COUNT(DISTINCT CASE WHEN tc.course_id IS NOT NULL THEN e.course_id END) > 0
      ),
      ranked_users AS (
        SELECT
          us.user_id,
          us.intersection::float / GREATEST(tc.cnt + us.other_count - us.intersection, 1) AS similarity
        FROM user_stats us, target_count tc
        ORDER BY similarity DESC
        LIMIT $4
      ),
      candidate_courses AS (
        SELECT
          e.course_id,
          SUM(ru.similarity)::float AS score
        FROM enrollment e
        JOIN ranked_users ru ON ru.user_id = e.user_id
        WHERE e.status IN ($2, $3)
          AND e.deleted_at IS NULL
          AND e.course_id <> ALL($5::text[])
        GROUP BY e.course_id
        ORDER BY score DESC
        LIMIT $6
      )
      SELECT course_id AS "courseId", score FROM candidate_courses
      `,
      [userId, 'active', 'completed', maxNeighbors, excludeArray, topN],
    );

    return rows;
  }
}
