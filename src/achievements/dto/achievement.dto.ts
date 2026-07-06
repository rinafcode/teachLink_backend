import { AchievementType, AchievementDifficulty } from '../entities/achievement.entity';

export class CreateAchievementDto {
  name: string;
  description: string;
  longDescription?: string;
  iconUrl: string;
  type: AchievementType;
  difficulty: AchievementDifficulty;
  pointsReward: number;
  experienceReward: number;
  criteria: any;
  progressConfig: any;
}

export class UpdateAchievementDto {
  name?: string;
  description?: string;
  longDescription?: string;
  iconUrl?: string;
  type?: AchievementType;
  difficulty?: AchievementDifficulty;
  pointsReward?: number;
  experienceReward?: number;
  criteria?: any;
  progressConfig?: any;
  isActive?: boolean;
  isHidden?: boolean;
}

export class AchievementResponseDto {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  iconUrl: string;
  type: AchievementType;
  difficulty: AchievementDifficulty;
  pointsReward: number;
  experienceReward: number;
  criteria: any;
  progressConfig: any;
  isActive: boolean;
  isHidden: boolean;
  unlockedBy?: number;
  createdAt: Date;
  updatedAt: Date;
}
