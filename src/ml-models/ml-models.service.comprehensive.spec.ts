import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MLModelsService } from './ml-models.service';
import { ModelVersioningService } from './versioning/model-versioning.service';
import { ModelDeploymentService } from './deployment/model-deployment.service';
import { ModelMonitoringService } from './monitoring/model-monitoring.service';
import { TrainingPipelineService } from './training/training-pipeline.service';
import { MLModel } from './entities/ml-model.entity';
import { ModelVersion } from './entities/model-version.entity';
import { ModelDeployment } from './entities/model-deployment.entity';
import { ModelPerformance } from './entities/model-performance.entity';
import { ABTest } from './entities/ab-test.entity';
import { 
  ModelStatus, 
  ModelType, 
  ModelFramework, 
  VersionStatus, 
  DeploymentStatus, 
  ABTestStatus,
  ABTestType 
} from './enums';
import { CreateModelDto } from './dto/create-model.dto';
import { TrainModelDto } from './dto/train-model.dto';
import { DeployModelDto } from './dto/deploy-model.dto';
import { CreateABTestDto } from './dto/create-ab-test.dto';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('MLModelsService - Comprehensive Tests', () => {
  let service: MLModelsService;
  let modelRepository: Repository<MLModel>;
  let versionRepository: Repository<ModelVersion>;
  let deploymentRepository: Repository<ModelDeployment>;
  let performanceRepository: Repository<ModelPerformance>;
  let abTestRepository: Repository<ABTest>;
  let cacheManager: any;
  let eventEmitter: EventEmitter2;
  let versioningService: ModelVersioningService;
  let deploymentService: ModelDeploymentService;
  let monitoringService: ModelMonitoringService;
  let trainingService: TrainingPipelineService;

  const mockModel: MLModel = {
    id: 'model-1',
    name: 'Test Classification Model',
    description: 'A test classification model',
    type: ModelType.CLASSIFICATION,
    framework: ModelFramework.SCIKIT_LEARN,
    status: ModelStatus.DRAFT,
    hyperparameters: { n_estimators: 100, max_depth: 10 },
    features: ['feature1', 'feature2', 'feature3'],
    targetVariable: 'target',
    metadata: { version: '1.0.0' },
    artifactPath: '/path/to/artifact',
    modelHash: 'abc123',
    currentAccuracy: 0.85,
    currentPrecision: 0.83,
    currentRecall: 0.87,
    currentF1Score: 0.85,
    trainingMetrics: { accuracy: 0.85 },
    validationMetrics: { accuracy: 0.83 },
    lastTrainedAt: new Date(),
    lastDeployedAt: null,
    createdBy: 'test-user',
    updatedBy: 'test-user',
    createdAt: new Date(),
    updatedAt: new Date(),
    versions: [],
    deployments: [],
    performances: [],
  };

  const mockVersion: ModelVersion = {
    id: 'version-1',
    modelId: 'model-1',
    version: 'v1.0.0',
    description: 'Initial version',
    status: VersionStatus.READY,
    artifactPath: '/path/to/version/artifact',
    modelHash: 'def456',
    trainingMetrics: { accuracy: 0.85 },
    validationMetrics: { accuracy: 0.83 },
    hyperparameters: { n_estimators: 100 },
    parentVersionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    model: mockModel,
    deployments: [],
  };

  const mockDeployment: ModelDeployment = {
    id: 'deployment-1',
    modelId: 'model-1',
    versionId: 'version-1',
    environment: 'staging',
    status: DeploymentStatus.ACTIVE,
    endpoint: 'https://api.staging.com/models/deployment-1',
    deploymentConfig: { resources: { memory: '1Gi', cpu: '0.5' } },
    healthCheckConfig: { endpoint: '/health', interval: 30 },
    scalingConfig: { minReplicas: 1, maxReplicas: 10 },
    monitoringConfig: { enableMetrics: true },
    deployedAt: new Date(),
    undeployedAt: null,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    model: mockModel,
    version: mockVersion,
  };

  const mockABTest: ABTest = {
    id: 'abtest-1',
    name: 'Test A/B Test',
    description: 'Testing model comparison',
    status: ABTestStatus.DRAFT,
    type: ABTestType.TRAFFIC_SPLIT,
    modelAId: 'model-1',
    modelBId: 'model-2',
    trafficSplit: 0.5,
    testConfig: { duration: 7 },
    successMetrics: ['accuracy', 'precision'],
    guardrailMetrics: ['latency'],
    minSampleSize: 1000,
    maxDurationDays: 14,
    significanceLevel: 0.05,
    results: null,
    winnerModelId: null,
    isStatisticallySignificant: null,
    confidenceLevel: null,
    modelAMetrics: null,
    modelBMetrics: null,
    startedAt: null,
    endedAt: null,
    scheduledEndAt: null,
    createdBy: 'test-user',
    stoppedBy: null,
    stopReason: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    modelA: mockModel,
    modelB: mockModel,
    winnerModel: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MLModelsService,
        {
          provide: getRepositoryToken(MLModel),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
            remove: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              skip: jest.fn().mockReturnThis(),
              take: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              getCount: jest.fn().mockResolvedValue(1),
              getMany: jest.fn().mockResolvedValue([mockModel]),
              getManyAndCount: jest.fn().mockResolvedValue([[mockModel], 1]),
            })),
          },
        },
        {
          provide: getRepositoryToken(ModelVersion),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              skip: jest.fn().mockReturnThis(),
              take: jest.fn().mockReturnThis(),
              getCount: jest.fn().mockResolvedValue(1),
              getMany: jest.fn().mockResolvedValue([mockVersion]),
            })),
          },
        },
        {
          provide: getRepositoryToken(ModelDeployment),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            count: jest.fn().mockResolvedValue(0),
            remove: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ModelPerformance),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ABTest),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            count: jest.fn().mockResolvedValue(0),
            update: jest.fn(),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            store: {
              keys: jest.fn().mockResolvedValue([]),
            },
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: ModelVersioningService,
          useValue: {
            createVersion: jest.fn().mockResolvedValue(mockVersion),
            getVersion: jest.fn().mockResolvedValue(mockVersion),
            getLatestVersion: jest.fn().mockResolvedValue(mockVersion),
            getModelVersions: jest.fn().mockResolvedValue({ versions: [mockVersion], total: 1 }),
            updateVersion: jest.fn().mockResolvedValue(mockVersion),
            deleteVersion: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: ModelDeploymentService,
          useValue: {
            deployModel: jest.fn().mockResolvedValue(mockDeployment),
            rollbackToVersion: jest.fn().mockResolvedValue(mockDeployment),
            undeployModel: jest.fn().mockResolvedValue(undefined),
            getDeploymentStatus: jest.fn().mockResolvedValue({ deployment: mockDeployment }),
            scaleDeployment: jest.fn().mockResolvedValue(mockDeployment),
            getDeploymentHistory: jest.fn().mockResolvedValue([mockDeployment]),
          },
        },
        {
          provide: ModelMonitoringService,
          useValue: {
            recordPrediction: jest.fn(),
            recordPerformanceMetrics: jest.fn(),
            detectModelDrift: jest.fn().mockResolvedValue({ driftDetected: false }),
            getModelPerformance: jest.fn().mockResolvedValue({ summary: {} }),
            detectAnomalies: jest.fn().mockResolvedValue({}),
            generateMonitoringReport: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: TrainingPipelineService,
          useValue: {
            trainModel: jest.fn().mockResolvedValue({ trainingId: 'train-1' }),
            hyperparameterTuning: jest.fn().mockResolvedValue({ bestParams: {} }),
            crossValidation: jest.fn().mockResolvedValue({ meanAccuracy: 0.85 }),
            validateModel: jest.fn().mockResolvedValue({ accuracy: 0.85 }),
          },
        },
      ],
    }).compile();

    service = module.get<MLModelsService>(MLModelsService);
    modelRepository = module.get<Repository<MLModel>>(getRepositoryToken(MLModel));
    versionRepository = module.get<Repository<ModelVersion>>(getRepositoryToken(ModelVersion));
    deploymentRepository = module.get<Repository<ModelDeployment>>(getRepositoryToken(ModelDeployment));
    performanceRepository = module.get<Repository<ModelPerformance>>(getRepositoryToken(ModelPerformance));
    abTestRepository = module.get<Repository<ABTest>>(getRepositoryToken(ABTest));
    cacheManager = module.get(CACHE_MANAGER);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    versioningService = module.get<ModelVersioningService>(ModelVersioningService);
    deploymentService = module.get<ModelDeploymentService>(ModelDeploymentService);
    monitoringService = module.get<ModelMonitoringService>(ModelMonitoringService);
    trainingService = module.get<TrainingPipelineService>(TrainingPipelineService);
  });

  describe('Model Management', () => {
    describe('createModel', () => {
      it('should create a new model successfully', async () => {
        const createModelDto: CreateModelDto = {
          name: 'New Test Model',
          description: 'A new test model',
          type: ModelType.CLASSIFICATION,
          framework: ModelFramework.SCIKIT_LEARN,
          hyperparameters: { n_estimators: 100 },
          features: ['feature1', 'feature2'],
          targetVariable: 'target',
          metadata: { version: '1.0.0' },
          createdBy: 'test-user',
        };

        jest.spyOn(modelRepository, 'findOne').mockResolvedValue(null);
        jest.spyOn(modelRepository, 'create').mockReturnValue(mockModel);
        jest.spyOn(modelRepository, 'save').mockResolvedValue(mockModel);
        jest.spyOn(cacheManager, 'del').mockResolvedValue(undefined);

        const result = await service.createModel(createModelDto);

        expect(result).toEqual(mockModel);
        expect(modelRepository.create).toHaveBeenCalledWith({
          ...createModelDto,
          status: ModelStatus.DRAFT,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        });
        expect(eventEmitter.emit).toHaveBeenCalledWith('model.created', {
          modelId: mockModel.id,
          model: mockModel,
        });
      });

      it('should throw error if model name already exists', async () => {
        const createModelDto: CreateModelDto = {
          name: 'Existing Model',
          type: ModelType.CLASSIFICATION,
          framework: ModelFramework.SCIKIT_LEARN,
        };

        jest.spyOn(modelRepository, 'findOne').mockResolvedValue(mockModel);

        await expect(service.createModel(createModelDto)).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('findAllModels', () => {
      it('should return paginated models with filters', async () => {
        const expectedResult = {
          models: [mockModel],
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        };

        jest.spyOn(cacheManager, 'get').mockResolvedValue(null);
        jest.spyOn(cacheManager, 'set').mockResolvedValue(undefined);

        const result = await service.findAllModels(1, 10, ModelStatus.DRAFT, ModelType.CLASSIFICATION);

        expect(result).toEqual(expectedResult);
        expect(cacheManager.set).toHaveBeenCalled();
      });

      it('should return cached result if available', async () => {
        const cachedResult = {
          models: [mockModel],
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        };

        jest.spyOn(cacheManager, 'get').mockResolvedValue(cachedResult);

        const result = await service.findAllModels(1, 10);

        expect(result).toEqual(cachedResult);
      });
    });

    describe('findModelById', () => {
      it('should return model by id', async () => {
        jest.spyOn(cacheManager, 'get').mockResolvedValue(null);
        jest.spyOn(cacheManager, 'set').mockResolvedValue(undefined);
        jest.spyOn(modelRepository, 'findOne').mockResolvedValue(mockModel);

        const result = await service.findModelById('model-1');

        expect(result).toEqual(mockModel);
      });

      it('should throw NotFoundException if model not found', async () => {
        jest.spyOn(cacheManager, 'get').mockResolvedValue(null);
        jest.spyOn(modelRepository, 'findOne').mockResolvedValue(null);

        await expect(service.findModelById('nonexistent')).rejects.toThrow(NotFoundException);
      });
    });

    describe('updateModel', () => {
      it('should update model successfully', async () => {
        const updateModelDto = { name: 'Updated Model Name' };
        const updatedModel = { ...mockModel, ...updateModelDto };

        jest.spyOn(service, 'findModelById').mockResolvedValue(mockModel);
        jest.spyOn(modelRepository, 'findOne').mockResolvedValue(null);
        jest.spyOn(modelRepository, 'save').mockResolvedValue(updatedModel);
        jest.spyOn(cacheManager, 'del').mockResolvedValue(undefined);

        const result = await service.updateModel('model-1', updateModelDto);

        expect(result).toEqual(updatedModel);
        expect(eventEmitter.emit).toHaveBeenCalledWith('model.updated', {
          modelId: 'model-1',
          model: updatedModel,
        });
      });
    });

    describe('deleteModel', () => {
      it('should delete model successfully', async () => {
        const draftModel = { ...mockModel, status: ModelStatus.DRAFT };
        
        jest.spyOn(service, 'findModelById').mockResolvedValue(draftModel);
        jest.spyOn(deploymentRepository, 'count').mockResolvedValue(0);
        jest.spyOn(abTestRepository, 'count').mockResolvedValue(0);
        jest.spyOn(modelRepository, 'remove').mockResolvedValue(draftModel);
        jest.spyOn(cacheManager, 'del').mockResolvedValue(undefined);

        await service.deleteModel('model-1');

        expect(modelRepository.remove).toHaveBeenCalledWith(draftModel);
        expect(eventEmitter.emit).toHaveBeenCalledWith('model.deleted', {
          modelId: 'model-1',
        });
      });

      it('should throw error if model is deployed', async () => {
        const deployedModel = { ...mockModel, status: ModelStatus.DEPLOYED };
        
        jest.spyOn(service, 'findModelById').mockResolvedValue(deployedModel);

        await expect(service.deleteModel('model-1')).rejects.toThrow(BadRequestException);
      });
    });
  });

  describe('Model Training', () => {
    describe('trainModel', () => {
      it('should start model training successfully', async () => {
        const trainModelDto: TrainModelDto = {
          trainingDataPath: '/path/to/data.csv',
          validationSplit: 0.2,
          enableHyperparameterOptimization: true,
          maxTrials: 20,
          description: 'Training with hyperparameter optimization',
        };

        const trainedModel = { ...mockModel, status: ModelStatus.TRAINED };
        
        jest.spyOn(service, 'findModelById').mockResolvedValue(trainedModel);
        jest.spyOn(service, 'updateModel').mockResolvedValue(trainedModel);

        const result = await service.trainModel('model-1', trainModelDto);

        expect(result).toEqual({
          modelId: 'model-1',
          versionId: mockVersion.id,
          status: 'training_started',
          message: 'Training has been initiated. You will be notified when it completes.',
        });
        expect(eventEmitter.emit).toHaveBeenCalledWith('model.training.started', {
          modelId: 'model-1',
          versionId: mockVersion.id,
          trainModelDto,
        });
      });

      it('should throw error if model is already training', async () => {
        const trainingModel = { ...mockModel, status: ModelStatus.TRAINING };
        
        jest.spyOn(service, 'findModelById').mockResolvedValue(trainingModel);

        await expect(service.trainModel('model-1', {} as TrainModelDto)).rejects.toThrow(
          BadRequestException,
        );
      });
    });
  });

  describe('Model Deployment', () => {
    describe('deployModel', () => {
      it('should deploy model successfully', async () => {
        const deployModelDto: DeployModelDto = {
          environment: 'staging',
          deploymentConfig: { resources: { memory: '1Gi' } },
          healthCheckConfig: { endpoint: '/health' },
        };

        const trainedModel = { ...mockModel, status: ModelStatus.TRAINED };
        
        jest.spyOn(service, 'findModelById').mockResolvedValue(trainedModel);

        const result = await service.deployModel('model-1', deployModelDto);

        expect(result).toEqual(mockDeployment);
        expect(deploymentService.deployModel).toHaveBeenCalledWith(
          trainedModel,
          mockVersion,
          deployModelDto,
        );
      });

      it('should throw error if model is not trained', async () => {
        const draftModel = { ...mockModel, status: ModelStatus.DRAFT };
        
        jest.spyOn(service, 'findModelById').mockResolvedValue(draftModel);

        await expect(service.deployModel('model-1', {} as DeployModelDto)).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('rollbackModel', () => {
      it('should rollback model successfully', async () => {
        jest.spyOn(service, 'findModelById').mockResolvedValue(mockModel);

        const result = await service.rollbackModel('model-1', 'version-1');

        expect(result).toEqual(mockDeployment);
        expect(deploymentService.rollbackToVersion).toHaveBeenCalledWith(
          mockModel,
          mockVersion,
        );
      });
    });
  });

  describe('A/B Testing', () => {
    describe('createABTest', () => {
      it('should create A/B test successfully', async () => {
        const createABTestDto: CreateABTestDto = {
          name: 'Test A/B Test',
          description: 'Testing model comparison',
          type: ABTestType.TRAFFIC_SPLIT,
          modelAId: 'model-1',
          modelBId: 'model-2',
          trafficSplit: 0.5,
          testConfig: { duration: 7 },
          successMetrics: ['accuracy', 'precision'],
          guardrailMetrics: ['latency'],
          minSampleSize: 1000,
          maxDurationDays: 14,
          significanceLevel: 0.05,
          createdBy: 'test-user',
        };

        const deployedModelA = { ...mockModel, status: ModelStatus.DEPLOYED };
        const deployedModelB = { ...mockModel, id: 'model-2', status: ModelStatus.DEPLOYED };
        
        jest.spyOn(service, 'findModelById')
          .mockResolvedValueOnce(deployedModelA)
          .mockResolvedValueOnce(deployedModelB);
        jest.spyOn(abTestRepository, 'create').mockReturnValue(mockABTest);
        jest.spyOn(abTestRepository, 'save').mockResolvedValue(mockABTest);

        const result = await service.createABTest(createABTestDto);

        expect(result).toEqual(mockABTest);
      });

      it('should throw error if models are not deployed', async () => {
        const createABTestDto: CreateABTestDto = {
          name: 'Test A/B Test',
          type: ABTestType.TRAFFIC_SPLIT,
          modelAId: 'model-1',
          modelBId: 'model-2',
          trafficSplit: 0.5,
        };

        const draftModel = { ...mockModel, status: ModelStatus.DRAFT };
        
        jest.spyOn(service, 'findModelById').mockResolvedValue(draftModel);

        await expect(service.createABTest(createABTestDto)).rejects.toThrow(BadRequestException);
      });
    });

    describe('startABTest', () => {
      it('should start A/B test successfully', async () => {
        const runningTest = { ...mockABTest, status: ABTestStatus.RUNNING };
        
        jest.spyOn(abTestRepository, 'findOne').mockResolvedValue(mockABTest);
        jest.spyOn(abTestRepository, 'save').mockResolvedValue(runningTest);

        const result = await service.startABTest('abtest-1');

        expect(result).toEqual(runningTest);
        expect(eventEmitter.emit).toHaveBeenCalledWith('abtest.started', {
          testId: 'abtest-1',
          test: runningTest,
        });
      });

      it('should throw error if test is not in draft status', async () => {
        const runningTest = { ...mockABTest, status: ABTestStatus.RUNNING };
        
        jest.spyOn(abTestRepository, 'findOne').mockResolvedValue(runningTest);

        await expect(service.startABTest('abtest-1')).rejects.toThrow(BadRequestException);
      });
    });
  });

  describe('Monitoring and Performance', () => {
    describe('getModelPerformance', () => {
      it('should return model performance data', async () => {
        const performanceData = {
          summary: { accuracy: 0.85 },
          trends: { accuracy: { trend: 'stable' } },
        };

        jest.spyOn(cacheManager, 'get').mockResolvedValue(null);
        jest.spyOn(cacheManager, 'set').mockResolvedValue(undefined);
        jest.spyOn(monitoringService, 'getModelPerformance').mockResolvedValue(performanceData);

        const result = await service.getModelPerformance('model-1', 30);

        expect(result).toEqual(performanceData);
      });
    });

    describe('getModelDrift', () => {
      it('should return model drift detection results', async () => {
        const driftResults = {
          driftDetected: false,
          overallDriftScore: 0.05,
          severity: 'LOW',
        };

        jest.spyOn(monitoringService, 'detectModelDrift').mockResolvedValue(driftResults);

        const result = await service.getModelDrift('model-1');

        expect(result).toEqual(driftResults);
      });
    });

    describe('getModelStatistics', () => {
      it('should return model statistics', async () => {
        const statistics = {
          totalModels: 10,
          deployedModels: 5,
          trainingModels: 2,
          draftModels: 3,
          totalVersions: 25,
          totalDeployments: 8,
          activeTests: 1,
          deploymentRate: 50,
          averageVersionsPerModel: 2.5,
        };

        jest.spyOn(cacheManager, 'get').mockResolvedValue(null);
        jest.spyOn(cacheManager, 'set').mockResolvedValue(undefined);
        jest.spyOn(modelRepository, 'count')
          .mockResolvedValueOnce(10) // totalModels
          .mockResolvedValueOnce(5)  // deployedModels
          .mockResolvedValueOnce(2)  // trainingModels
          .mockResolvedValueOnce(3); // draftModels
        jest.spyOn(versionRepository, 'count').mockResolvedValue(25);
        jest.spyOn(deploymentRepository, 'count').mockResolvedValue(8);
        jest.spyOn(abTestRepository, 'count').mockResolvedValue(1);

        const result = await service.getModelStatistics();

        expect(result).toEqual(statistics);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      jest.spyOn(modelRepository, 'findOne').mockRejectedValue(new Error('Database connection failed'));

      await expect(service.findModelById('model-1')).rejects.toThrow();
    });

    it('should handle cache errors gracefully', async () => {
      jest.spyOn(cacheManager, 'get').mockRejectedValue(new Error('Cache connection failed'));
      jest.spyOn(modelRepository, 'findOne').mockResolvedValue(mockModel);

      // Should still work even if cache fails
      const result = await service.findModelById('model-1');
      expect(result).toEqual(mockModel);
    });
  });

  describe('Performance Optimization', () => {
    it('should use caching for frequently accessed data', async () => {
      const cachedData = { models: [mockModel], total: 1 };
      jest.spyOn(cacheManager, 'get').mockResolvedValue(cachedData);

      const result = await service.findAllModels(1, 10);

      expect(result).toEqual(cachedData);
      expect(modelRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should clear cache when data is updated', async () => {
      jest.spyOn(service, 'findModelById').mockResolvedValue(mockModel);
      jest.spyOn(modelRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(modelRepository, 'save').mockResolvedValue(mockModel);
      jest.spyOn(cacheManager, 'del').mockResolvedValue(undefined);

      await service.updateModel('model-1', { name: 'Updated' });

      expect(cacheManager.del).toHaveBeenCalled();
    });
  });

  describe('Event Emission', () => {
    it('should emit events for important operations', async () => {
      jest.spyOn(modelRepository, 'findOne').mockResolvedValue(null);
      jest.spyOn(modelRepository, 'create').mockReturnValue(mockModel);
      jest.spyOn(modelRepository, 'save').mockResolvedValue(mockModel);
      jest.spyOn(cacheManager, 'del').mockResolvedValue(undefined);

      await service.createModel({
        name: 'Test Model',
        type: ModelType.CLASSIFICATION,
        framework: ModelFramework.SCIKIT_LEARN,
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith('model.created', {
        modelId: mockModel.id,
        model: mockModel,
      });
    });
  });
});
