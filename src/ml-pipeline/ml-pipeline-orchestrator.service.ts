import { Injectable } from '@nestjs/common';
import { TrainingService } from './training/training.service';
import { ModelDeploymentService } from './deployment/model-deployment.service';
import { ModelMonitoringService } from './monitoring/model-monitoring.service';
import { ModelVersioningService } from './versioning/model-versioning.service';
import { ModelTestingService } from './testing/model-testing.service';

@Injectable()
export class MLPipelineOrchestratorService {
  constructor(
    private readonly trainingService: TrainingService,
    private readonly deploymentService: ModelDeploymentService,
    private readonly monitoringService: ModelMonitoringService,
    private readonly versioningService: ModelVersioningService,
    private readonly testingService: ModelTestingService,
  ) {}

  async runFullPipeline(trainingData: any, testData: any) {
    // 1. Train model
    const { model, metrics } = await this.trainingService.trainModel(trainingData);

    // 2. Version the model
    const versionId = await this.versioningService.saveVersion(model);

    // 3. Deploy the model
    const deploymentId = await this.deploymentService.deployModel(model);

    // 4. Monitor the model
    const monitoringResult = await this.monitoringService.monitorPerformance(deploymentId);

    // 5. (Optional) A/B test with another model
    // const abTestResult = await this.testingService.abTest(modelA, modelB, testData);

    // 6. (Optional) Rollback if drift detected
    if (monitoringResult.driftDetected) {
      await this.deploymentService.rollbackModel(versionId);
    }

    return {
      versionId,
      deploymentId,
      monitoringResult,
      // abTestResult,
    };
  }
} 