import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Course, CourseStatus } from '../courses/entities/course.entity';
import { Enrollment } from '../courses/entities/enrollment.entity';
import { CachingService } from '../caching/caching.service';
import { CollaborativeFilteringService } from './collaborative-filtering.service';
import { ContentBasedFilteringService } from './content-based-filtering.service';
import { RecommendedCourseDto } from './dto/recommendation.dto';

const CACHE_TTL_SECONDS = 300; // 5 minutes
const COLLABORATIVE_WEIGHT = 0.6;
const CONTENT_WEIGHT = 0.4;

/**
 * Hybrid recommendation engine combining collaborative and content-based filtering.
 *
 * Results are cached in Redis with a 5-minute TTL to achieve <100 ms response times.
 */
@Injectable()
export class RecommendationEngineService {
  private readonly logger = new Logger(RecommendationEngineService.name);

  constructor(
    @InjectRepository(Course)
    private readonly courseRepo: Repository<Course>,
    @InjectRepository(Enrollment)
    private readonly enrollmentRepo: Repository<Enrollment>,
    private readonly caching: CachingService,
    private readonly collaborative: CollaborativeFilteringService,
    private readonly contentBased: ContentBasedFilteringService,
  ) {}

  async getRecommendations(userId: string, limit = 10): Promise<RecommendedCourseDto[]> {
    const cacheKey = `recommendations:${userId}:${limit}`;

    return this.caching.getOrSet(
      cacheKey,
      () => this.computeRecommendations(userId, limit),
      CACHE_TTL_SECONDS,
    );
  }

  /** Invalidate cached recommendations for a user (e.g., after a new enrollment). */
  async invalidate(userId: string): Promise<void> {
    // Delete all variants (any limit) matching the namespace prefix
    await this.caching.deleteByPattern(`recommendations:${userId}:*`);
  }

  private async computeRecommendations(
    userId: string,
    limit: number,
  ): Promise<RecommendedCourseDto[]> {
    // Load user's enrollments
    const userEnrollments = await this.enrollmentRepo.find({
      select: ['courseId'],
      where: [
        { userId, status: 'active' },
        { userId, status: 'completed' },
      ],
    });
    const enrolledIds = userEnrollments.map((e) => e.courseId);
    const excludeSet = new Set(enrolledIds);

    const candidateLimit = limit * 3; // fetch more than needed before merging

    const [collaborative, contentBased] = await Promise.all([
      this.collaborative.getRecommendedCourseIds(userId, excludeSet, candidateLimit),
      this.contentBased.getRecommendedCourseIds(enrolledIds, excludeSet, candidateLimit),
    ]);

    // Merge & normalise scores
    const scoreMap = new Map<string, { collab: number; content: number }>();

    const maxCollab = collaborative[0]?.score ?? 1;
    for (const { courseId, score } of collaborative) {
      scoreMap.set(courseId, { collab: score / maxCollab, content: 0 });
    }

    const maxContent = contentBased[0]?.score ?? 1;
    for (const { courseId, score } of contentBased) {
      const existing = scoreMap.get(courseId) ?? { collab: 0, content: 0 };
      scoreMap.set(courseId, { ...existing, content: score / maxContent });
    }

    const ranked = [...scoreMap.entries()]
      .map(([courseId, s]) => ({
        courseId,
        hybridScore: s.collab * COLLABORATIVE_WEIGHT + s.content * CONTENT_WEIGHT,
        reason: this.classifyReason(s.collab, s.content),
      }))
      .sort((a, b) => b.hybridScore - a.hybridScore)
      .slice(0, limit);

    if (ranked.length === 0) return this.fallbackPopular(excludeSet, limit);

    const courseIds = ranked.map((r) => r.courseId);
    const courses = await this.courseRepo.find({
      select: ['id', 'title', 'description', 'category', 'price'],
      where: { id: In(courseIds), status: CourseStatus.PUBLISHED },
    });

    const courseMap = new Map(courses.map((c) => [c.id, c]));

    return ranked
      .filter((r) => courseMap.has(r.courseId))
      .map((r) => {
        const c = courseMap.get(r.courseId)!;
        return {
          id: c.id,
          title: c.title,
          description: c.description,
          category: c.category,
          price: Number(c.price),
          score: Math.round(r.hybridScore * 1000) / 1000,
          reason: r.reason,
        };
      });
  }

  /** Fall back to recently published courses when no signal exists (cold start). */
  private async fallbackPopular(
    excludeSet: Set<string>,
    limit: number,
  ): Promise<RecommendedCourseDto[]> {
    const courses = await this.courseRepo.find({
      select: ['id', 'title', 'description', 'category', 'price'],
      where: { status: CourseStatus.PUBLISHED },
      order: { createdAt: 'DESC' },
      take: limit + excludeSet.size,
    });

    return courses
      .filter((c) => !excludeSet.has(c.id))
      .slice(0, limit)
      .map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        category: c.category,
        price: Number(c.price),
        score: 0,
        reason: 'content-based' as const,
      }));
  }

  private classifyReason(
    collab: number,
    content: number,
  ): 'collaborative' | 'content-based' | 'hybrid' {
    if (collab > 0 && content > 0) return 'hybrid';
    if (collab > 0) return 'collaborative';
    return 'content-based';
  }
}
