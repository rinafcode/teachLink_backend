import { Test, TestingModule } from '@nestjs/testing';
import { MLPipelineOrchestratorService } from './ml-pipeline-orchestrator.service';
import { TrainingService } from './training/training.service';
import { ModelDeploymentService } from './deployment/model-deployment.service';
import { ModelMonitoringService } from './monitoring/model-monitoring.service';
import { ModelVersioningService } from './versioning/model-versioning.service';
import { ModelTestingService } from './testing/model-testing.service';

describe('MLPipelineOrchestratorService', () => {
  let service: MLPipelineOrchestratorService;
  let trainingService: TrainingService;
  let deploymentService: ModelDeploymentService;
  let monitoringService: ModelMonitoringService;
  let versioningService: ModelVersioningService;
  let testingService: ModelTestingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MLPipelineOrchestratorService,
        {
          provide: TrainingService,
          useValue: { trainModel: jest.fn().mockResolvedValue({ model: 'mock-model', metrics: { accuracy: 0.99 } }) },
        },
        {
          provide: ModelDeploymentService,
          useValue: {
            deployModel: jest.fn().mockResolvedValue('mock-deployment-id'),
            rollbackModel: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: ModelMonitoringService,
          useValue: { monitorPerformance: jest.fn().mockResolvedValue({ modelId: 'mock-deployment-id', driftDetected: false, metrics: { accuracy: 0.99 } }) },
        },
        {
          provide: ModelVersioningService,
          useValue: { saveVersion: jest.fn().mockResolvedValue('mock-version-id') },
        },
        {
          provide: ModelTestingService,
          useValue: { abTest: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<MLPipelineOrchestratorService>(MLPipelineOrchestratorService);
    trainingService = module.get<TrainingService>(TrainingService);
    deploymentService = module.get<ModelDeploymentService>(ModelDeploymentService);
    monitoringService = module.get<ModelMonitoringService>(ModelMonitoringService);
    versioningService = module.get<ModelVersioningService>(ModelVersioningService);
    testingService = module.get<ModelTestingService>(ModelTestingService);
  });

  it('should run the full pipeline and return results', async () => {
    const result = await service.runFullPipeline({ some: 'trainingData' }, { some: 'testData' });
    expect(result).toEqual({
      versionId: 'mock-version-id',
      deploymentId: 'mock-deployment-id',
      monitoringResult: { modelId: 'mock-deployment-id', driftDetected: false, metrics: { accuracy: 0.99 } },
      // abTestResult: undefined,
    });
    expect(trainingService.trainModel).toHaveBeenCalled();
    expect(versioningService.saveVersion).toHaveBeenCalled();
    expect(deploymentService.deployModel).toHaveBeenCalled();
    expect(monitoringService.monitorPerformance).toHaveBeenCalled();
  });
}); 