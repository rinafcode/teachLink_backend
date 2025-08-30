import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
import { ModelStatus, ModelType, ModelFramework, VersionStatus, DeploymentStatus, ABTestStatus } from './enums';
import { CreateModelDto } from './dto/create-model.dto';
import { TrainModelDto } from './dto/train-model.dto';
import { DeployModelDto } from './dto/deploy-model.dto';
import { CreateABTestDto } from './dto/create-ab-test.dto';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('MLModelsService', () => {
  let service: MLModelsService;
  let modelRepository: Repository<MLModel>;
  let versionRepository: Repository<ModelVersion>;
  let deploymentRepository: Repository<ModelDeployment>;
  let performanceRepository: Repository<ModelPerformance>;
  let abTestRepository: Repository<ABTest>;
  let versioningService: ModelVersioningService;
  let deploymentService: ModelDeploymentService;
  let monitoringService: ModelMonitoringService;
  let trainingService: TrainingPipelineService;

  const mockModel: MLModel = {
    id: 'model-1',
    name: 'Test Model',
    description: 'A test model',
    type: ModelType.CLASSIFICATION,
    framework: ModelFramework.SCIKIT_LEARN,
    status: ModelStatus.DRAFT,
    hyperparameters: { max_depth: 10 },
    features: ['feature1', 'feature2'],
    targetVariable: 'target',
    metadata: {},
    artifactPath: null,
    modelHash: null,
    currentAccuracy: null,
    currentPrecision: null,
    currentRecall: null,
    currentF1Score: null,
    trainingMetrics: null,
    validationMetrics: null,
    lastTrainedAt: null,
    lastDeployedAt: null,
    createdBy: 'user1',
    updatedBy: null,
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
    status: VersionStatus.TRAINED,
    hyperparameters: { max_depth: 10 },
    trainingConfig: {},
    dataConfig: {},
    artifactPath: '/models/model-1/v1.0.0.model',
    modelHash: 'hash123',
    parentVersionId: null,
    trainingMetrics: { accuracy: 0.95 },
    validationMetrics: { accuracy: 0.93 },
    testMetrics: { accuracy: 0.94 },
    accuracy: 0.95,
    precision: 0.94,
    recall: 0.93,
    f1Score: 0.935,
    featureImportance: { feature1: 0.6, feature2: 0.4 },
    confusionMatrix: [[90, 10], [5, 95]],
    rocCurve: { fpr: [0, 1], tpr: [0, 1] },
    metadata: {},
    trainedAt: new Date(),
    validatedAt: new Date(),
    createdBy: 'user1',
    updatedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    model: mockModel,
    deployments: [],
  };

  const mockDeployment: ModelDeployment = {
    id: 'deployment-1',
    modelId: 'model-1',
    versionId: 'version-1',
    name: 'Test Deployment',
    description: 'Test deployment',
    status: DeploymentStatus.ACTIVE,
    environment: 'production',
    endpoint: 'https://api.example.com/v1/models/deployment-1',
    serviceUrl: 'https://deployment-1.production.ml.example.com',
    deploymentConfig: {},
    scalingConfig: {},
    resourceConfig: {},
    healthCheckConfig: {},
    previousDeploymentId: null,
    rollbackToDeploymentId: null,
    deploymentMetrics: {},
    currentAccuracy: 0.94,
    currentLatency: 100,
    requestCount: 1000,
    errorCount: 10,
    errorRate: 0.01,
    performanceMetrics: {},
    deployedAt: new Date(),
    activatedAt: new Date(),
    rolledBackAt: null,
    deployedBy: 'user1',
    rolledBackBy: null,
    failureReason: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    model: mockModel,
    version: mockVersion,
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
            createQueryBuilder: jest.fn(() => ({
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              skip: jest.fn().mockReturnThis(),
              take: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              getCount: jest.fn().mockResolvedValue(1),
              getMany: jest.fn().mockResolvedValue([mockModel]),
            })),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ModelVersion),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
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
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ModelPerformance),
          useValue: {
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ABTest),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: ModelVersioningService,
          useValue: {
            createVersion: jest.fn(),
            getVersion: jest.fn(),
            saveModelArtifact: jest.fn(),
          },
        },
        {
          provide: ModelDeploymentService,
          useValue: {
            deployModel: jest.fn(),
            rollbackModel: jest.fn(),
            getDeployment: jest.fn(),
          },
        },
        {
          provide: ModelMonitoringService,
          useValue: {
            recordPerformance: jest.fn(),
            monitorModelPerformance: jest.fn(),
            detectModelDrift: jest.fn(),
          },
        },
        {
          provide: TrainingPipelineService,
          useValue: {
            trainModel: jest.fn(),
            hyperparameterTuning: jest.fn(),
            crossValidation: jest.fn(),
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
    versioningService = module.get<ModelVersioningService>(ModelVersioningService);
    deploymentService = module.get<ModelDeploymentService>(ModelDeploymentService);
    monitoringService = module.get<ModelMonitoringService>(ModelMonitoringService);
    trainingService = module.get<TrainingPipelineService>(TrainingPipelineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createModel', () => {
    it('should create a new model', async () => {
      const createModelDto: CreateModelDto = {
        name: 'Test Model',
        description: 'A test model',
        type: ModelType.CLASSIFICATION,
        framework: ModelFramework.SCIKIT_LEARN,
        hyperparameters: { max_depth: 10 },
        features: ['feature1', 'feature2'],
        targetVariable: 'target',
        createdBy: 'user1',
      };

      const createdModel = { ...mockModel, ...createModelDto };
      jest.spyOn(modelRepository, 'create').mockReturnValue(createdModel);
      jest.spyOn(modelRepository, 'save').mockResolvedValue(createdModel);

      const result = await service.createModel(createModelDto);

      expect(result).toEqual(createdModel);
      expect(modelRepository.create).toHaveBeenCalledWith({
        ...createModelDto,
        status: ModelStatus.DRAFT,
      });
      expect(modelRepository.save).toHaveBeenCalledWith(createdModel);
    });
  });

  describe('findAllModels', () => {
    it('should return models with pagination', async () => {
      const result = await service.findAllModels(1, 10);

      expect(result).toEqual({
        models: [mockModel],
        total: 1,
      });
    });

    it('should filter models by status', async () => {
      await service.findAllModels(1, 10, ModelStatus.DRAFT);

      expect(modelRepository.createQueryBuilder).toHaveBeenCalled();
    });
  });

  describe('findModelById', () => {
    it('should return a model by ID', async () => {
      jest.spyOn(modelRepository, 'findOne').mockResolvedValue(mockModel);

      const result = await service.findModelById('model-1');

      expect(result).toEqual(mockModel);
      expect(modelRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'model-1' },
        relations: ['versions', 'deployments', 'performances'],
      });
    });

    it('should throw NotFoundException when model not found', async () => {
      jest.spyOn(modelRepository, 'findOne').mockResolvedValue(null);

      await expect(service.findModelById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateModel', () => {
    it('should update a model', async () => {
      const updateModelDto = { name: 'Updated Model' };
      const updatedModel = { ...mockModel, ...updateModelDto };

      jest.spyOn(modelRepository, 'findOne').mockResolvedValue(mockModel);
      jest.spyOn(modelRepository, 'save').mockResolvedValue(updatedModel);

      const result = await service.updateModel('model-1', updateModelDto);

      expect(result).toEqual(updatedModel);
      expect(modelRepository.save).toHaveBeenCalledWith(updatedModel);
    });
  });

  describe('deleteModel', () => {
    it('should delete a model', async () => {
      jest.spyOn(modelRepository, 'findOne').mockResolvedValue(mockModel);
      jest.spyOn(deploymentRepository, 'count').mockResolvedValue(0);
      jest.spyOn(modelRepository, 'remove').mockResolvedValue(mockModel);

      await service.deleteModel('model-1');

      expect(modelRepository.remove).toHaveBeenCalledWith(mockModel);
    });

    it('should throw BadRequestException when model has active deployments', async () => {
      jest.spyOn(modelRepository, 'findOne').mockResolvedValue(mockModel);
      jest.spyOn(deploymentRepository, 'count').mockResolvedValue(1);

      await expect(service.deleteModel('model-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('trainModel', () => {
    it('should train a model successfully', async () => {
      const trainModelDto: TrainModelDto = {
        modelId: 'model-1',
        version: 'v1.0.0',
        description: 'Training run',
        hyperparameters: { max_depth: 10 },
        trainedBy: 'user1',
      };

      const trainingResult = {
        modelData: Buffer.from('model data'),
        trainingMetrics: { accuracy: 0.95 },
        validationMetrics: { accuracy: 0.93 },
        testMetrics: { accuracy: 0.94 },
        accuracy: 0.95,
        precision: 0.94,
        recall: 0.93,
        f1Score: 0.935,
        featureImportance: { feature1: 0.6, feature2: 0.4 },
        confusionMatrix: [[90, 10], [5, 95]],
        rocCurve: { fpr: [0, 1], tpr: [0, 1] },
        artifactPath: '/models/model-1/v1.0.0.model',
        modelHash: 'hash123',
      };

      jest.spyOn(modelRepository, 'findOne').mockResolvedValue(mockModel);
      jest.spyOn(versionRepository, 'create').mockReturnValue(mockVersion);
      jest.spyOn(versionRepository, 'save').mockResolvedValue(mockVersion);
      jest.spyOn(trainingService, 'trainModel').mockResolvedValue(trainingResult);

      const result = await service.trainModel(trainModelDto);

      expect(result).toEqual(mockVersion);
      expect(trainingService.trainModel).toHaveBeenCalledWith(
        mockModel,
        mockVersion,
        trainModelDto,
      );
    });

    it('should handle training failure', async () => {
      const trainModelDto: TrainModelDto = {
        modelId: 'model-1',
        version: 'v1.0.0',
        trainedBy: 'user1',
      };

      jest.spyOn(modelRepository, 'findOne').mockResolvedValue(mockModel);
      jest.spyOn(versionRepository, 'create').mockReturnValue(mockVersion);
      jest.spyOn(versionRepository, 'save').mockResolvedValue(mockVersion);
      jest.spyOn(trainingService, 'trainModel').mockRejectedValue(new Error('Training failed'));

      await expect(service.trainModel(trainModelDto)).rejects.toThrow('Training failed');
    });
  });

  describe('deployModel', () => {
    it('should deploy a model successfully', async () => {
      const deployModelDto: DeployModelDto = {
        modelId: 'model-1',
        versionId: 'version-1',
        name: 'Test Deployment',
        environment: 'production',
        deployedBy: 'user1',
      };

      const deploymentResult = {
        endpoint: 'https://api.example.com/v1/models/deployment-1',
        serviceUrl: 'https://deployment-1.production.ml.example.com',
        deploymentConfig: {},
        infrastructureResult: {},
        artifactResult: {},
        servingResult: {},
        monitoringResult: {},
      };

      jest.spyOn(modelRepository, 'findOne').mockResolvedValue(mockModel);
      jest.spyOn(versionRepository, 'findOne').mockResolvedValue(mockVersion);
      jest.spyOn(deploymentRepository, 'create').mockReturnValue(mockDeployment);
      jest.spyOn(deploymentRepository, 'save').mockResolvedValue(mockDeployment);
      jest.spyOn(deploymentService, 'deployModel').mockResolvedValue(deploymentResult);

      const result = await service.deployModel(deployModelDto);

      expect(result).toEqual(mockDeployment);
      expect(deploymentService.deployModel).toHaveBeenCalledWith(
        mockModel,
        mockVersion,
        mockDeployment,
        deployModelDto,
      );
    });

    it('should throw error when version is not trained', async () => {
      const deployModelDto: DeployModelDto = {
        modelId: 'model-1',
        versionId: 'version-1',
        environment: 'production',
      };

      const untrainedVersion = { ...mockVersion, status: VersionStatus.DRAFT };

      jest.spyOn(modelRepository, 'findOne').mockResolvedValue(mockModel);
      jest.spyOn(versionRepository, 'findOne').mockResolvedValue(untrainedVersion);

      await expect(service.deployModel(deployModelDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('rollbackDeployment', () => {
    it('should rollback deployment successfully', async () => {
      const rollbackDeployment = { ...mockDeployment, id: 'deployment-2' };

      jest.spyOn(deploymentRepository, 'findOne')
        .mockResolvedValueOnce(mockDeployment)
        .mockResolvedValueOnce(rollbackDeployment);
      jest.spyOn(deploymentService, 'rollbackModel').mockResolvedValue(undefined);
      jest.spyOn(deploymentRepository, 'save').mockResolvedValue(rollbackDeployment);

      const result = await service.rollbackDeployment('deployment-1', 'deployment-2');

      expect(result).toEqual(rollbackDeployment);
      expect(deploymentService.rollbackModel).toHaveBeenCalledWith(
        mockDeployment,
        rollbackDeployment,
      );
    });
  });

  describe('getModelPerformance', () => {
    it('should return model performance metrics', async () => {
      const mockPerformance = {
        id: 'perf-1',
        modelId: 'model-1',
        metricName: 'accuracy',
        metricType: 'accuracy',
        value: 0.95,
        recordedAt: new Date(),
      };

      jest.spyOn(performanceRepository, 'find').mockResolvedValue([mockPerformance]);

      const result = await service.getModelPerformance('model-1', 30);

      expect(result).toEqual([mockPerformance]);
      expect(performanceRepository.find).toHaveBeenCalled();
    });
  });

  describe('createABTest', () => {
    it('should create an A/B test', async () => {
      const createABTestDto: CreateABTestDto = {
        name: 'Test A/B Test',
        description: 'Testing two models',
        type: 'traffic_split',
        modelAId: 'model-1',
        modelBId: 'model-2',
        trafficSplit: 0.5,
        createdBy: 'user1',
      };

      const mockABTest = {
        id: 'abtest-1',
        ...createABTestDto,
        status: ABTestStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(modelRepository, 'findOne')
        .mockResolvedValueOnce(mockModel)
        .mockResolvedValueOnce({ ...mockModel, id: 'model-2', status: ModelStatus.DEPLOYED });
      jest.spyOn(abTestRepository, 'create').mockReturnValue(mockABTest);
      jest.spyOn(abTestRepository, 'save').mockResolvedValue(mockABTest);

      const result = await service.createABTest(createABTestDto);

      expect(result).toEqual(mockABTest);
    });

    it('should throw error when models are not deployed', async () => {
      const createABTestDto: CreateABTestDto = {
        name: 'Test A/B Test',
        type: 'traffic_split',
        modelAId: 'model-1',
        modelBId: 'model-2',
      };

      jest.spyOn(modelRepository, 'findOne')
        .mockResolvedValueOnce({ ...mockModel, status: ModelStatus.TRAINED })
        .mockResolvedValueOnce({ ...mockModel, id: 'model-2', status: ModelStatus.TRAINED });

      await expect(service.createABTest(createABTestDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('startABTest', () => {
    it('should start an A/B test', async () => {
      const mockABTest = {
        id: 'abtest-1',
        name: 'Test A/B Test',
        status: ABTestStatus.DRAFT,
        modelAId: 'model-1',
        modelBId: 'model-2',
        startedAt: null,
      };

      jest.spyOn(abTestRepository, 'findOne').mockResolvedValue(mockABTest);
      jest.spyOn(abTestRepository, 'save').mockResolvedValue({
        ...mockABTest,
        status: ABTestStatus.RUNNING,
        startedAt: new Date(),
      });

      const result = await service.startABTest('abtest-1');

      expect(result.status).toBe(ABTestStatus.RUNNING);
      expect(result.startedAt).toBeDefined();
    });
  });

  describe('stopABTest', () => {
    it('should stop an A/B test', async () => {
      const mockABTest = {
        id: 'abtest-1',
        name: 'Test A/B Test',
        status: ABTestStatus.RUNNING,
        modelAId: 'model-1',
        modelBId: 'model-2',
        endedAt: null,
      };

      jest.spyOn(abTestRepository, 'findOne').mockResolvedValue(mockABTest);
      jest.spyOn(abTestRepository, 'save').mockResolvedValue({
        ...mockABTest,
        status: ABTestStatus.COMPLETED,
        endedAt: new Date(),
        results: { winner: 'model-1' },
      });

      const result = await service.stopABTest('abtest-1', 'Test completed');

      expect(result.status).toBe(ABTestStatus.COMPLETED);
      expect(result.endedAt).toBeDefined();
    });
  });

  describe('getModelLineage', () => {
    it('should return model lineage', async () => {
      jest.spyOn(modelRepository, 'findOne').mockResolvedValue(mockModel);
      jest.spyOn(versionRepository, 'find').mockResolvedValue([mockVersion]);
      jest.spyOn(deploymentRepository, 'find').mockResolvedValue([mockDeployment]);

      const result = await service.getModelLineage('model-1');

      expect(result).toHaveProperty('model');
      expect(result).toHaveProperty('versions');
      expect(result).toHaveProperty('deployments');
      expect(result).toHaveProperty('lineage');
    });
  });
}); 