import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseInteraction } from '../entities/course-interaction.entity';

@Injectable()
export class ContentSimilarityService {
  constructor(
    @InjectRepository(CourseInteraction)
    private courseInteractionRepository: Repository<CourseInteraction>,
  ) {}

  async calculateCourseSimilarity(
    courseId1: string,
    courseId2: string,
  ): Promise<number> {
    // Get all interactions for both courses
    const interactions1 = await this.courseInteractionRepository.find({
      where: { courseId: courseId1 },
    });
    const interactions2 = await this.courseInteractionRepository.find({
      where: { courseId: courseId2 },
    });

    // Calculate similarity based on user behavior patterns
    const similarity = this.computeSimilarityScore(
      interactions1,
      interactions2,
    );
    return similarity;
  }

  private computeSimilarityScore(
    interactions1: CourseInteraction[],
    interactions2: CourseInteraction[],
  ): number {
    // Implement cosine similarity or other similarity metrics
    // This is a simplified version
    const commonUsers = new Set(
      interactions1
        .map((i) => i.userId)
        .filter((id) => interactions2.some((i) => i.userId === id)),
    );

    if (commonUsers.size === 0) return 0;

    const totalUsers = new Set([
      ...interactions1.map((i) => i.userId),
      ...interactions2.map((i) => i.userId),
    ]).size;

    return commonUsers.size / totalUsers;
  }

  async findSimilarCourses(
    courseId: string,
    limit: number = 5,
  ): Promise<string[]> {
    const allCourses = await this.courseInteractionRepository
      .createQueryBuilder('interaction')
      .select('DISTINCT interaction.courseId')
      .where('interaction.courseId != :courseId', { courseId })
      .getRawMany();

    const similarities = await Promise.all(
      allCourses.map(async ({ courseId: otherCourseId }) => ({
        courseId: otherCourseId,
        similarity: await this.calculateCourseSimilarity(
          courseId,
          otherCourseId,
        ),
      })),
    );

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map((item) => item.courseId);
  }
}
