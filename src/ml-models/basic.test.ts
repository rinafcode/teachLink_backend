import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MLModelsService } from './ml-models.service';
import { MLModel } from './entities/ml-model.entity';
import { ModelStatus, ModelType, ModelFramework } from './enums';
import { CreateModelDto } from './dto/create-model.dto';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('MLModelsService - Basic Tests', () => {
  let service: MLModelsService;
  let modelRepository: Repository<MLModel>;

  const mockModel: MLModel = {
    id: 'test-1',
    name: 'Test Model',
    description: 'A test model',
    type: ModelType.CLASSIFICATION,
    framework: ModelFramework.SCIKIT_LEARN,
    status: ModelStatus.DRAFT,
    hyperparameters: { n_estimators: 100 },
    features: ['feature1', 'feature2'],
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
          provide: getRepositoryToken('ModelVersion'),
          useValue: { create: jest.fn(), save: jest.fn(), findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken('ModelDeployment'),
          useValue: { create: jest.fn(), save: jest.fn(), findOne: jest.fn(), count: jest.fn().mockResolvedValue(0) },
        },
        {
          provide: getRepositoryToken('ModelPerformance'),
          useValue: { create: jest.fn(), save: jest.fn(), find: jest.fn() },
        },
        {
          provide: getRepositoryToken('ABTest'),
          useValue: { create: jest.fn(), save: jest.fn(), findOne: jest.fn(), count: jest.fn().mockResolvedValue(0) },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
            store: { keys: jest.fn().mockResolvedValue([]) },
          },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
        {
          provide: 'ModelVersioningService',
          useValue: {
            createVersion: jest.fn(),
            getVersion: jest.fn(),
            getLatestVersion: jest.fn(),
            getModelVersions: jest.fn(),
            updateVersion: jest.fn(),
            deleteVersion: jest.fn(),
          },
        },
        {
          provide: 'ModelDeploymentService',
          useValue: {
            deployModel: jest.fn(),
            rollbackToVersion: jest.fn(),
            undeployModel: jest.fn(),
            getDeploymentStatus: jest.fn(),
            scaleDeployment: jest.fn(),
            getDeploymentHistory: jest.fn(),
          },
        },
        {
          provide: 'ModelMonitoringService',
          useValue: {
            recordPrediction: jest.fn(),
            recordPerformanceMetrics: jest.fn(),
            detectModelDrift: jest.fn(),
            getModelPerformance: jest.fn(),
            detectAnomalies: jest.fn(),
            generateMonitoringReport: jest.fn(),
          },
        },
        {
          provide: 'TrainingPipelineService',
          useValue: {
            trainModel: jest.fn(),
            hyperparameterTuning: jest.fn(),
            crossValidation: jest.fn(),
            validateModel: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MLModelsService>(MLModelsService);
    modelRepository = module.get<Repository<MLModel>>(getRepositoryToken(MLModel));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a model', async () => {
    const createModelDto: CreateModelDto = {
      name: 'New Test Model',
      type: ModelType.CLASSIFICATION,
      framework: ModelFramework.SCIKIT_LEARN,
      hyperparameters: { n_estimators: 100 },
      features: ['feature1', 'feature2'],
      targetVariable: 'target',
      createdBy: 'test-user',
    };

    jest.spyOn(modelRepository, 'findOne').mockResolvedValue(null);
    jest.spyOn(modelRepository, 'create').mockReturnValue(mockModel);
    jest.spyOn(modelRepository, 'save').mockResolvedValue(mockModel);

    const result = await service.createModel(createModelDto);

    expect(result).toEqual(mockModel);
    expect(modelRepository.create).toHaveBeenCalledWith({
      ...createModelDto,
      status: ModelStatus.DRAFT,
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
  });

  it('should find model by id', async () => {
    jest.spyOn(modelRepository, 'findOne').mockResolvedValue(mockModel);

    const result = await service.findModelById('test-1');

    expect(result).toEqual(mockModel);
  });

  it('should throw error when model not found', async () => {
    jest.spyOn(modelRepository, 'findOne').mockResolvedValue(null);

    await expect(service.findModelById('nonexistent')).rejects.toThrow(NotFoundException);
  });

  it('should return paginated models', async () => {
    const expectedResult = {
      models: [mockModel],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    };

    const result = await service.findAllModels(1, 10);

    expect(result).toEqual(expectedResult);
  });
});
