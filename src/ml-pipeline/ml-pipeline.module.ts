import { Module } from '@nestjs/common';
import { TrainingService } from './training/training.service';
import { ModelDeploymentService } from './deployment/model-deployment.service';
import { ModelMonitoringService } from './monitoring/model-monitoring.service';
import { ModelVersioningService } from './versioning/model-versioning.service';
import { ModelTestingService } from './testing/model-testing.service';

@Module({
  providers: [
    TrainingService,
    ModelDeploymentService,
    ModelMonitoringService,
    ModelVersioningService,
    ModelTestingService,
  ],
  exports: [
    TrainingService,
    ModelDeploymentService,
    ModelMonitoringService,
    ModelVersioningService,
    ModelTestingService,
  ],
})
export class MLPipelineModule {}
