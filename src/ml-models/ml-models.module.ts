import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MLModelsController } from './ml-models.controller';
import { MLModelsService } from './ml-models.service';
import { ModelVersioningService } from './versioning/model-versioning.service';
import { ModelDeploymentService } from './deployment/model-deployment.service';
import { ModelMonitoringService } from './monitoring/model-monitoring.service';
import { TrainingPipelineService } from './training/training-pipeline.service';

// Entities
import { MLModel } from './entities/ml-model.entity';
import { ModelVersion } from './entities/model-version.entity';
import { ModelDeployment } from './entities/model-deployment.entity';
import { ModelPerformance } from './entities/model-performance.entity';
import { ABTest } from './entities/ab-test.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MLModel,
      ModelVersion,
      ModelDeployment,
      ModelPerformance,
      ABTest,
    ]),
  ],
  controllers: [MLModelsController],
  providers: [
    MLModelsService,
    ModelVersioningService,
    ModelDeploymentService,
    ModelMonitoringService,
    TrainingPipelineService,
  ],
  exports: [
    MLModelsService,
    ModelVersioningService,
    ModelDeploymentService,
    ModelMonitoringService,
    TrainingPipelineService,
  ],
})
export class MLModelsModule {}
