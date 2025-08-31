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
import { ModelStatus, ModelType, ModelFramework } from './enums';
import { NotFoundException } from '@nestjs/common';

describe('MLModelsService - Basic Tests', () => {
  let service: MLModelsService;
  let modelRepository: Repository<MLModel>;

  const mockModel = {
    id: 'model-1',
    name: 'Test Model',
    type: ModelType.CLASSIFICATION,
    framework: ModelFramework.SCIKIT_LEARN,
    status: ModelStatus.DRAFT,
    createdAt: new Date(),
    updatedAt: new Date(),
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
              getMany: jest.fn().mockResolvedValue([]),
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
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a model', async () => {
    const createModelDto = {
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
  });

  it('should find a model by ID', async () => {
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

  it('should get all models with pagination', async () => {
    const result = await service.findAllModels(1, 10);

    expect(result).toEqual({
      models: [mockModel],
      total: 1,
    });
  });
}); 