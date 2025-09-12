import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CourseInteraction } from '../entities/course-interaction.entity';
import { UserPreference } from '../entities/user-preference.entity';

@Injectable()
export class MLModelService {
  constructor(
    @InjectRepository(CourseInteraction)
    private courseInteractionRepository: Repository<CourseInteraction>,
    @InjectRepository(UserPreference)
    private userPreferenceRepository: Repository<UserPreference>,
  ) {}

  async generateRecommendations(
    userId: string,
    limit: number = 5,
  ): Promise<string[]> {
    // Get user preferences and interactions
    const userPreference = await this.userPreferenceRepository.findOne({
      where: { userId },
    });
    const userInteractions = await this.courseInteractionRepository.find({
      where: { userId },
    });

    if (!userPreference || userInteractions.length === 0) {
      return this.getPopularCourses(limit);
    }

    // Combine collaborative filtering and content-based filtering
    const collaborativeScores = await this.collaborativeFiltering(userId);
    const contentScores = await this.contentBasedFiltering(userPreference);

    // Combine scores with weights
    const finalScores = this.combineScores(collaborativeScores, contentScores);

    // Return top recommendations
    return Object.entries(finalScores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([courseId]) => courseId);
  }

  private async collaborativeFiltering(
    userId: string,
  ): Promise<Record<string, number>> {
    const userInteractions = await this.courseInteractionRepository.find({
      where: { userId },
    });

    const scores: Record<string, number> = {};
    for (const interaction of userInteractions) {
      const similarUsers = await this.findSimilarUsers(interaction.courseId);
      for (const similarUser of similarUsers) {
        const similarUserInteractions =
          await this.courseInteractionRepository.find({
            where: { userId: similarUser },
          });

        for (const similarInteraction of similarUserInteractions) {
          scores[similarInteraction.courseId] =
            (scores[similarInteraction.courseId] || 0) +
            similarInteraction.rating * interaction.rating;
        }
      }
    }

    return scores;
  }

  private async contentBasedFiltering(
    userPreference: UserPreference,
  ): Promise<Record<string, number>> {
    // Implement content-based filtering based on user preferences
    // This is a simplified version
    const scores: Record<string, number> = {};
    const allInteractions = await this.courseInteractionRepository.find();

    for (const interaction of allInteractions) {
      const score = this.calculateContentScore(interaction, userPreference);
      scores[interaction.courseId] =
        (scores[interaction.courseId] || 0) + score;
    }

    return scores;
  }

  private calculateContentScore(
    interaction: CourseInteraction,
    userPreference: UserPreference,
  ): number {
    // Implement content scoring based on user preferences and course metadata
    // This is a simplified version
    return interaction.rating * userPreference.engagementScore;
  }

  private async findSimilarUsers(courseId: string): Promise<string[]> {
    const interactions = await this.courseInteractionRepository.find({
      where: { courseId },
    });
    return [...new Set(interactions.map((i) => i.userId))];
  }

  private async getPopularCourses(limit: number): Promise<string[]> {
    const popularCourses = await this.courseInteractionRepository
      .createQueryBuilder('interaction')
      .select('interaction.courseId')
      .addSelect('AVG(interaction.rating)', 'avgRating')
      .groupBy('interaction.courseId')
      .orderBy('avgRating', 'DESC')
      .limit(limit)
      .getRawMany();

    return popularCourses.map((course) => course.courseId);
  }

  private combineScores(
    collaborativeScores: Record<string, number>,
    contentScores: Record<string, number>,
  ): Record<string, number> {
    const combinedScores: Record<string, number> = {};
    const collaborativeWeight = 0.6;
    const contentWeight = 0.4;

    for (const courseId of new Set([
      ...Object.keys(collaborativeScores),
      ...Object.keys(contentScores),
    ])) {
      combinedScores[courseId] =
        (collaborativeScores[courseId] || 0) * collaborativeWeight +
        (contentScores[courseId] || 0) * contentWeight;
    }

    return combinedScores;
  }
}
