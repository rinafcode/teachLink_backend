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

  // Simplified mock data
  const mockModel: Partial<MLModel> = {
    id: 'model-1',
    name: 'Test Model',
    type: ModelType.CLASSIFICATION,
    framework: ModelFramework.SCIKIT_LEARN,
    status: ModelStatus.DRAFT,
    hyperparameters: { max_depth: 10 },
    features: ['feature1', 'feature2'],
    targetVariable: 'target',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockVersion: Partial<ModelVersion> = {
    id: 'version-1',
    modelId: 'model-1',
    version: 'v1.0.0',
    status: VersionStatus.TRAINED,
    accuracy: 0.95,
    precision: 0.94,
    recall: 0.93,
    f1Score: 0.935,
    trainedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDeployment: Partial<ModelDeployment> = {
    id: 'deployment-1',
    modelId: 'model-1',
    versionId: 'version-1',
    name: 'Test Deployment',
    status: DeploymentStatus.ACTIVE,
    environment: 'production',
    deployedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Simplified mock repositories
  const createMockRepository = () => ({
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    remove: jest.fn(),
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
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MLModelsService,
        {
          provide: getRepositoryToken(MLModel),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(ModelVersion),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(ModelDeployment),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(ModelPerformance),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(ABTest),
          useValue: createMockRepository(),
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

  afterEach(() => {
    jest.clearAllMocks();
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
      jest.spyOn(modelRepository, 'create').mockReturnValue(createdModel as MLModel);
      jest.spyOn(modelRepository, 'save').mockResolvedValue(createdModel as MLModel);

      const result = await service.createModel(createModelDto);

      expect(result).toEqual(createdModel);
      expect(modelRepository.create).toHaveBeenCalledWith({
        ...createModelDto,
        status: ModelStatus.DRAFT,
      });
      expect(modelRepository.save).toHaveBeenCalledWith(createdModel);
    });
  });

  describe('findModelById', () => {
    it('should return a model by ID', async () => {
      jest.spyOn(modelRepository, 'findOne').mockResolvedValue(mockModel as MLModel);

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

      jest.spyOn(modelRepository, 'findOne').mockResolvedValue(mockModel as MLModel);
      jest.spyOn(modelRepository, 'save').mockResolvedValue(updatedModel as MLModel);

      const result = await service.updateModel('model-1', updateModelDto);

      expect(result).toEqual(updatedModel);
      expect(modelRepository.save).toHaveBeenCalledWith(updatedModel);
    });
  });

  describe('deleteModel', () => {
    it('should delete a model', async () => {
      jest.spyOn(modelRepository, 'findOne').mockResolvedValue(mockModel as MLModel);
      jest.spyOn(deploymentRepository, 'count').mockResolvedValue(0);
      jest.spyOn(modelRepository, 'remove').mockResolvedValue(mockModel as MLModel);

      await service.deleteModel('model-1');

      expect(modelRepository.remove).toHaveBeenCalledWith(mockModel);
    });

    it('should throw BadRequestException when model has active deployments', async () => {
      jest.spyOn(modelRepository, 'findOne').mockResolvedValue(mockModel as MLModel);
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

      jest.spyOn(modelRepository, 'findOne').mockResolvedValue(mockModel as MLModel);
      jest.spyOn(versionRepository, 'create').mockReturnValue(mockVersion as ModelVersion);
      jest.spyOn(versionRepository, 'save').mockResolvedValue(mockVersion as ModelVersion);
      jest.spyOn(trainingService, 'trainModel').mockResolvedValue(trainingResult);

      const result = await service.trainModel(trainModelDto);

      expect(result).toEqual(mockVersion);
      expect(trainingService.trainModel).toHaveBeenCalledWith(
        mockModel,
        mockVersion,
        trainModelDto,
      );
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

      jest.spyOn(modelRepository, 'findOne').mockResolvedValue(mockModel as MLModel);
      jest.spyOn(versionRepository, 'findOne').mockResolvedValue(mockVersion as ModelVersion);
      jest.spyOn(deploymentRepository, 'create').mockReturnValue(mockDeployment as ModelDeployment);
      jest.spyOn(deploymentRepository, 'save').mockResolvedValue(mockDeployment as ModelDeployment);
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
        .mockResolvedValueOnce(mockModel as MLModel)
        .mockResolvedValueOnce({ ...mockModel, id: 'model-2', status: ModelStatus.DEPLOYED } as MLModel);
      jest.spyOn(abTestRepository, 'create').mockReturnValue(mockABTest as ABTest);
      jest.spyOn(abTestRepository, 'save').mockResolvedValue(mockABTest as ABTest);

      const result = await service.createABTest(createABTestDto);

      expect(result).toEqual(mockABTest);
    });
  });
}); 