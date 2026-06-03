import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Course, CourseStatus } from '../courses/entities/course.entity';

/**
 * Implements content-based filtering using course attributes.
 *
 * Strategy: build a category preference profile from the user's enrolled courses,
 * then score all remaining published courses by how well their attributes match.
 *
 * Scoring factors (equally weighted):
 * - Category match (1.0 per shared category)
 * - Price proximity (0–1 based on price range similarity)
 */
@Injectable()
export class ContentBasedFilteringService {
  constructor(
    @InjectRepository(Course)
    private readonly courseRepo: Repository<Course>,
  ) {}

  async getRecommendedCourseIds(
    enrolledCourseIds: string[],
    excludeCourseIds: Set<string>,
    topN: number,
  ): Promise<Array<{ courseId: string; score: number }>> {
    if (enrolledCourseIds.length === 0) return [];

    const [enrolledCourses, allCourses] = await Promise.all([
      this.courseRepo.find({
        select: ['id', 'category', 'price'],
        where: { id: In(enrolledCourseIds) },
      }),
      this.courseRepo.find({
        select: ['id', 'category', 'price'],
        where: { status: CourseStatus.PUBLISHED },
      }),
    ]);

    const categoryFreq = new Map<string, number>();
    let avgPrice = 0;

    for (const c of enrolledCourses) {
      if (c.category) categoryFreq.set(c.category, (categoryFreq.get(c.category) ?? 0) + 1);
      avgPrice += Number(c.price);
    }
    avgPrice /= enrolledCourses.length;
    const maxFreq = Math.max(...categoryFreq.values(), 1);

    const priceRange = avgPrice > 0 ? avgPrice : 100;

    const scores: Array<{ courseId: string; score: number }> = [];

    for (const course of allCourses) {
      if (
        enrolledCourseIds.includes(course.id) ||
        excludeCourseIds.has(course.id)
      ) continue;

      let score = 0;

      // Category score (normalised)
      if (course.category && categoryFreq.has(course.category)) {
        score += categoryFreq.get(course.category)! / maxFreq;
      }

      // Price proximity score
      const priceDiff = Math.abs(Number(course.price) - avgPrice);
      score += Math.max(0, 1 - priceDiff / priceRange);

      if (score > 0) scores.push({ courseId: course.id, score });
    }

    return scores.sort((a, b) => b.score - a.score).slice(0, topN);
  }
}
