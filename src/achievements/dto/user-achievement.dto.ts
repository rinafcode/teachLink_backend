import { AchievementResponseDto } from './achievement.dto';

export class UserAchievementDto {
  id: string;
  userId: string;
  achievementId: string;
  achievement: AchievementResponseDto;
  unlockedAt: Date;
  unlockedMetadata?: any;
  pointsEarned: number;
  experienceEarned: number;
  notificationSent: boolean;
  isHidden: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class AchievementUnlockedEventDto {
  userId: string;
  achievementId: string;
  achievement: AchievementResponseDto;
  pointsEarned: number;
  experienceEarned: number;
  unlockedAt: Date;
}
