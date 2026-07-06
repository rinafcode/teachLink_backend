export class AchievementStatisticsDto {
  id: string;
  achievementId: string;
  date: Date;
  totalUnlocked: number;
  unlockedToday: number;
  unlockedPercentage: number;
  averageTimeToUnlock?: number;
  activeTrackers: number;
  averageProgress: number;
  engagementTrend?: 'positive' | 'negative' | 'stable';
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

export class AchievementLeaderboardDto {
  userId: string;
  username: string;
  totalAchievements: number;
  totalPoints: number;
  totalExperience: number;
  rank: number;
}

export class AchievementOverviewDto {
  totalAchievements: number;
  unlockedAchievements: number;
  progressPercentage: number;
  totalPointsEarned: number;
  totalExperienceEarned: number;
  userRank: number;
}
