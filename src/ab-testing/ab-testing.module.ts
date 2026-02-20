import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Experiment } from './entities/experiment.entity';
import { ExperimentVariant } from './entities/experiment-variant.entity';
import { ExperimentMetric } from './entities/experiment-metric.entity';
import { VariantMetric } from './entities/variant-metric.entity';
import { ABTestingService } from './ab-testing.service';
import { ExperimentService } from './experiments/experiment.service';
import { StatisticalAnalysisService } from './analysis/statistical-analysis.service';
import { AutomatedDecisionService } from './automation/automated-decision.service';
import { ABTestingReportsService } from './reporting/ab-testing-reports.service';
import { ABTestingController } from './ab-testing.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Experiment,
      ExperimentVariant,
      ExperimentMetric,
      VariantMetric
    ]),
  ],
  controllers: [
    ABTestingController,
  ],
  providers: [
    ABTestingService,
    ExperimentService,
    StatisticalAnalysisService,
    AutomatedDecisionService,
    ABTestingReportsService,
  ],
  exports: [
    ABTestingService,
    ExperimentService,
    StatisticalAnalysisService,
    AutomatedDecisionService,
    ABTestingReportsService,
  ],
})
export class ABTestingModule {}