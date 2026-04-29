import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OnboardingStep } from './entities/onboarding-step.entity';
import { UserOnboardingProgress } from './entities/user-onboarding-progress.entity';
import { OnboardingReward } from './entities/onboarding-reward.entity';
import { OnboardingService } from './onboarding.service';
import { OnboardingController } from './onboarding.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OnboardingStep,
      UserOnboardingProgress,
      OnboardingReward,
    ]),
  ],
  providers: [OnboardingService],
  controllers: [OnboardingController],
  exports: [OnboardingService],
})
export class OnboardingModule {}
