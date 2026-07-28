import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Achievement } from './entities/achievement.entity';
import { AchievementProgress } from './entities/achievement-progress.entity';
import { UserAchievement } from './entities/user-achievement.entity';
import { AchievementStatistics } from './entities/achievement-statistics.entity';
import { AchievementsService } from './achievements.service';
import { AchievementsController } from './achievements.controller';
import { AchievementsNotificationsService } from './achievements-notifications.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Achievement,
      AchievementProgress,
      UserAchievement,
      AchievementStatistics,
    ]),
    ScheduleModule.forRoot(),
  ],
  controllers: [AchievementsController],
  providers: [AchievementsService, AchievementsNotificationsService],
  exports: [AchievementsService, AchievementsNotificationsService],
})
export class AchievementsModule {}
