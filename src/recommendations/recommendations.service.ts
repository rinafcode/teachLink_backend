import { Injectable } from '@nestjs/common';
import { UserPreferencesService } from './preferences/user-preferences.service';
import { ContentSimilarityService } from './similarity/content-similarity.service';
import { MLModelService } from './ml/ml-model.service';
import { CourseInteraction } from './entities/course-interaction.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class RecommendationsService {
  constructor(
    private userPreferencesService: UserPreferencesService,
    private contentSimilarityService: ContentSimilarityService,
    private mlModelService: MLModelService,
    @InjectRepository(CourseInteraction)
    private courseInteractionRepository: Repository<CourseInteraction>,
  ) {}

  async getPersonalizedRecommendations(
    userId: string,
    limit: number = 5,
  ): Promise<string[]> {
    return this.mlModelService.generateRecommendations(userId, limit);
  }

  async getSimilarCourses(
    courseId: string,
    limit: number = 5,
  ): Promise<string[]> {
    return this.contentSimilarityService.findSimilarCourses(courseId, limit);
  }

  async trackUserInteraction(
    userId: string,
    courseId: string,
    interaction: Partial<CourseInteraction>,
  ): Promise<void> {
    const newInteraction = this.courseInteractionRepository.create({
      userId,
      courseId,
      ...interaction,
    });
    await this.courseInteractionRepository.save(newInteraction);

    // Update user engagement score based on interaction
    const engagementScore = await this.calculateEngagementScore(userId);
    await this.userPreferencesService.updateEngagementScore(
      userId,
      engagementScore,
    );
  }

  private async calculateEngagementScore(userId: string): Promise<number> {
    const interactions = await this.courseInteractionRepository.find({
      where: { userId },
    });

    if (interactions.length === 0) return 0;

    const totalScore = interactions.reduce((sum, interaction) => {
      return (
        sum +
        interaction.rating * interaction.completionRate * interaction.timeSpent
      );
    }, 0);

    return totalScore / interactions.length;
  }

  async updateUserPreferences(
    userId: string,
    preferences: {
      interests?: string[];
      skillLevels?: Record<string, number>;
      learningGoals?: string[];
    },
  ): Promise<void> {
    await this.userPreferencesService.updateUserPreferences(
      userId,
      preferences,
    );
  }
}
