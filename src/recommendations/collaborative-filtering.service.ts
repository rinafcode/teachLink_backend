import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Enrollment } from '../courses/entities/enrollment.entity';

/**
 * Implements user-based collaborative filtering.
 *
 * Algorithm:
 * 1. Load all active/completed enrollments.
 * 2. Build a user→course set map.
 * 3. Compute Jaccard similarity between the target user and every other user.
 * 4. Aggregate course scores from the most similar users (weighted by similarity).
 * 5. Return ranked course IDs the target user has NOT yet enrolled in.
 */
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
    const enrollments = await this.enrollmentRepo.find({
      select: ['userId', 'courseId'],
      where: [{ status: 'active' }, { status: 'completed' }],
    });

    const userCourses = new Map<string, Set<string>>();
    for (const e of enrollments) {
      if (!userCourses.has(e.userId)) userCourses.set(e.userId, new Set());
      userCourses.get(e.userId)!.add(e.courseId);
    }

    const targetCourses = userCourses.get(userId) ?? new Set<string>();
    const courseScores = new Map<string, number>();

    for (const [otherUserId, otherCourses] of userCourses) {
      if (otherUserId === userId) continue;

      const similarity = this.jaccardSimilarity(targetCourses, otherCourses);
      if (similarity === 0) continue;

      for (const courseId of otherCourses) {
        if (targetCourses.has(courseId) || excludeCourseIds.has(courseId)) continue;
        courseScores.set(courseId, (courseScores.get(courseId) ?? 0) + similarity);
      }
    }

    return [...courseScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([courseId, score]) => ({ courseId, score }));
  }

  private jaccardSimilarity(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 && b.size === 0) return 0;
    let intersection = 0;
    for (const id of a) {
      if (b.has(id)) intersection++;
    }
    const union = a.size + b.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }
}
