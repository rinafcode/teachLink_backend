import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPreference } from '../entities/user-preference.entity';

@Injectable()
export class UserPreferencesService {
  constructor(
    @InjectRepository(UserPreference)
    private userPreferenceRepository: Repository<UserPreference>,
  ) {}

  async getUserPreferences(userId: string): Promise<UserPreference> {
    return this.userPreferenceRepository.findOne({ where: { userId } });
  }

  async updateUserPreferences(
    userId: string,
    preferences: Partial<UserPreference>,
  ): Promise<UserPreference> {
    let userPreference = await this.getUserPreferences(userId);

    if (!userPreference) {
      userPreference = this.userPreferenceRepository.create({
        userId,
        ...preferences,
        engagementScore: 0,
      });
    } else {
      Object.assign(userPreference, preferences);
    }

    return this.userPreferenceRepository.save(userPreference);
  }

  async updateEngagementScore(userId: string, score: number): Promise<void> {
    await this.userPreferenceRepository.update(
      { userId },
      { engagementScore: score },
    );
  }

  async getSimilarUsers(userId: string): Promise<string[]> {
    const userPreference = await this.getUserPreferences(userId);
    if (!userPreference) return [];

    // Find users with similar interests and skill levels
    const similarUsers = await this.userPreferenceRepository
      .createQueryBuilder('preference')
      .where('preference.userId != :userId', { userId })
      .andWhere('preference.interests && :interests', {
        interests: userPreference.interests,
      })
      .select('preference.userId')
      .getMany();

    return similarUsers.map((user) => user.userId);
  }
}
