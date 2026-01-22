import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './users/entities/user.entity';
import { GamificationModule } from './gamification/gamification.module';
import { PointTransaction } from './gamification/entities/point-transaction.entity';
import { UserProgress } from './gamification/entities/user-progress.entity';
import { Badge } from './gamification/entities/badge.entity';
import { UserBadge } from './gamification/entities/user-badge.entity';
import { Challenge } from './gamification/entities/challenge.entity';
import { UserChallenge } from './gamification/entities/user-challenge.entity';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_DATABASE || 'teachlink',
      entities: [
        User,
        PointTransaction,
        UserProgress,
        Badge,
        UserBadge,
        Challenge,
        UserChallenge,
      ],
      synchronize: true, // Set to false in production
    }),
    GamificationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
