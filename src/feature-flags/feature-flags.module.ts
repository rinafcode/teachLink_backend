import { Module } from '@nestjs/common';
import { FlagEvaluationService } from './evaluation/flag-evaluation.service';
import { TargetingService } from './targeting/targeting.service';
import { RolloutService } from './rollout/rollout.service';
import { ExperimentationService } from './experimentation/experimentation.service';
import { FlagAnalyticsService } from './analytics/flag-analytics.service';

@Module({
  providers: [
    FlagAnalyticsService,
    TargetingService,
    RolloutService,
    ExperimentationService,
    FlagEvaluationService,
  ],
  exports: [
    FlagEvaluationService,
    TargetingService,
    RolloutService,
    ExperimentationService,
    FlagAnalyticsService,
  ],
})
export class FeatureFlagsModule {}
