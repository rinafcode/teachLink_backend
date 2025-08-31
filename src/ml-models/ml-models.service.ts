import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, QueryBuilder, Not } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MLModel } from './entities/ml-model.entity';
import { ModelVersion } from './entities/model-version.entity';
import { ModelDeployment } from './entities/model-deployment.entity';
import { ModelPerformance } from './entities/model-performance.entity';
import { ABTest } from './entities/ab-test.entity';
import { ModelStatus, ModelType, ModelFramework, VersionStatus, DeploymentStatus, ABTestStatus } from './enums';
import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';
import { TrainModelDto } from './dto/train-model.dto';
import { DeployModelDto } from './dto/deploy-model.dto';
import { CreateABTestDto } from './dto/create-ab-test.dto';
import { ModelVersioningService } from './versioning/model-versioning.service';
import { ModelDeploymentService } from './deployment/model-deployment.service';
import { ModelMonitoringService } from './monitoring/model-monitoring.service';
import { TrainingPipelineService } from './training/training-pipeline.service';

@Injectable()
export class MLModelsService {
  private readonly logger = new Logger(MLModelsService.name);
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly CACHE_PREFIX = 'ml_model';

  constructor(
    @InjectRepository(MLModel)
    private readonly modelRepository: Repository<MLModel>,
    @InjectRepository(ModelVersion)
    private readonly versionRepository: Repository<ModelVersion>,
    @InjectRepository(ModelDeployment)
    private readonly deploymentRepository: Repository<ModelDeployment>,
    @InjectRepository(ModelPerformance)
    private readonly performanceRepository: Repository<ModelPerformance>,
    @InjectRepository(ABTest)
    private readonly abTestRepository: Repository<ABTest>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly versioningService: ModelVersioningService,
    private readonly deploymentService: ModelDeploymentService,
    private readonly monitoringService: ModelMonitoringService,
    private readonly trainingService: TrainingPipelineService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createModel(createModelDto: CreateModelDto): Promise<MLModel> {
    try {
      // Validate model name uniqueness
      const existingModel = await this.modelRepository.findOne({
        where: { name: createModelDto.name }
      });

      if (existingModel) {
        throw new BadRequestException(`Model with name '${createModelDto.name}' already exists`);
      }

      const model = this.modelRepository.create({
        ...createModelDto,
        status: ModelStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const savedModel = await this.modelRepository.save(model);
      
      // Clear cache
      await this.clearModelCache();
      
      // Emit event
      this.eventEmitter.emit('model.created', { modelId: savedModel.id, model: savedModel });
      
      this.logger.log(`Created model: ${savedModel.id} - ${savedModel.name}`);
      return savedModel;
    } catch (error) {
      this.logger.error(`Failed to create model: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findAllModels(
    page: number = 1,
    limit: number = 10,
    status?: ModelStatus,
    type?: ModelType,
    framework?: ModelFramework,
    search?: string,
  ): Promise<{ models: MLModel[]; total: number; page: number; limit: number; totalPages: number }> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}:list:${page}:${limit}:${status}:${type}:${framework}:${search}`;
      const cached = await this.cacheManager.get(cacheKey);
      
      if (cached) {
        return cached as any;
      }

      const query = this.buildModelQuery(status, type, framework, search);

      const [models, total] = await query
        .skip((page - 1) * limit)
        .take(limit)
        .orderBy('model.createdAt', 'DESC')
        .getManyAndCount();

      const result = {
        models,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };

      // Cache the result
      await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to fetch models: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findModelById(id: string): Promise<MLModel> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}:${id}`;
      const cached = await this.cacheManager.get(cacheKey);
      
      if (cached) {
        return cached as MLModel;
      }

      const model = await this.modelRepository.findOne({
        where: { id },
        relations: ['versions', 'deployments', 'performances'],
      });

      if (!model) {
        throw new NotFoundException(`Model with ID ${id} not found`);
      }

      // Cache the model
      await this.cacheManager.set(cacheKey, model, this.CACHE_TTL);
      
      return model;
    } catch (error) {
      this.logger.error(`Failed to fetch model ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateModel(id: string, updateModelDto: UpdateModelDto): Promise<MLModel> {
    try {
      const model = await this.findModelById(id);
      
      // Check if name is being updated and if it's unique
      if (updateModelDto.name && updateModelDto.name !== model.name) {
        const existingModel = await this.modelRepository.findOne({
          where: { name: updateModelDto.name, id: Not(id) }
        });

        if (existingModel) {
          throw new BadRequestException(`Model with name '${updateModelDto.name}' already exists`);
        }
      }
      
      Object.assign(model, updateModelDto, { updatedAt: new Date() });
      const updatedModel = await this.modelRepository.save(model);
      
      // Clear cache
      await this.clearModelCache(id);
      
      // Emit event
      this.eventEmitter.emit('model.updated', { modelId: id, model: updatedModel });
      
      this.logger.log(`Updated model: ${id}`);
      return updatedModel;
    } catch (error) {
      this.logger.error(`Failed to update model ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deleteModel(id: string): Promise<void> {
    try {
      const model = await this.findModelById(id);
      
      // Check if model can be deleted
      if (model.status === ModelStatus.DEPLOYED) {
        throw new BadRequestException('Cannot delete a deployed model. Please undeploy it first.');
      }

      // Check for active deployments
      const activeDeployments = await this.deploymentRepository.count({
        where: { modelId: id, status: In([DeploymentStatus.ACTIVE, DeploymentStatus.DEPLOYING]) }
      });

      if (activeDeployments > 0) {
        throw new BadRequestException('Cannot delete model with active deployments');
      }

      // Check for active A/B tests
      const activeTests = await this.abTestRepository.count({
        where: { 
          status: ABTestStatus.RUNNING,
          modelAId: id 
        }
      });

      if (activeTests > 0) {
        throw new BadRequestException('Cannot delete model that is part of an active A/B test');
      }

      await this.modelRepository.remove(model);
      
      // Clear cache
      await this.clearModelCache(id);
      
      // Emit event
      this.eventEmitter.emit('model.deleted', { modelId: id });
      
      this.logger.log(`Deleted model: ${id}`);
    } catch (error) {
      this.logger.error(`Failed to delete model ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async trainModel(modelId: string, trainModelDto: TrainModelDto): Promise<any> {
    try {
      const model = await this.findModelById(modelId);
      
      if (model.status === ModelStatus.TRAINING) {
        throw new BadRequestException('Model is already being trained');
      }

      // Update model status
      await this.updateModel(modelId, { status: ModelStatus.TRAINING });

      // Create new version
      const version = await this.versioningService.createVersion(
        modelId,
        this.generateVersionNumber(model),
        trainModelDto.description || 'Auto-generated version from training'
      );

      // Start training asynchronously
      this.eventEmitter.emit('model.training.started', { 
        modelId, 
        versionId: version.id, 
        trainModelDto 
      });

      return {
        modelId,
        versionId: version.id,
        status: 'training_started',
        message: 'Training has been initiated. You will be notified when it completes.'
      };
    } catch (error) {
      this.logger.error(`Failed to start training for model ${modelId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deployModel(modelId: string, deployModelDto: DeployModelDto): Promise<any> {
    try {
      const model = await this.findModelById(modelId);
      
      if (model.status !== ModelStatus.TRAINED) {
        throw new BadRequestException('Model must be trained before deployment');
      }

      // Get the latest version
      const latestVersion = await this.versioningService.getLatestVersion(modelId);
      if (!latestVersion || latestVersion.status !== VersionStatus.READY) {
        throw new BadRequestException('No ready version available for deployment');
      }

      // Start deployment
      const deployment = await this.deploymentService.deployModel(
        model,
        latestVersion,
        deployModelDto
      );

      return deployment;
    } catch (error) {
      this.logger.error(`Failed to deploy model ${modelId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async createABTest(createABTestDto: CreateABTestDto): Promise<ABTest> {
    try {
      // Validate models exist and are deployed
      const [modelA, modelB] = await Promise.all([
        this.findModelById(createABTestDto.modelAId),
        this.findModelById(createABTestDto.modelBId)
      ]);

      if (modelA.status !== ModelStatus.DEPLOYED || modelB.status !== ModelStatus.DEPLOYED) {
        throw new BadRequestException('Both models must be deployed to create an A/B test');
      }

      // Validate traffic split
      if (createABTestDto.trafficSplit <= 0 || createABTestDto.trafficSplit >= 1) {
        throw new BadRequestException('Traffic split must be between 0 and 1');
      }

      const abTest = this.abTestRepository.create({
        ...createABTestDto,
        status: ABTestStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const savedTest = await this.abTestRepository.save(abTest);
      
      this.logger.log(`Created A/B test: ${savedTest.id}`);
      return savedTest;
    } catch (error) {
      this.logger.error(`Failed to create A/B test: ${error.message}`, error.stack);
      throw error;
    }
  }

  async startABTest(testId: string): Promise<ABTest> {
    try {
      const test = await this.abTestRepository.findOne({
        where: { id: testId },
        relations: ['modelA', 'modelB']
      });

      if (!test) {
        throw new NotFoundException(`A/B test with ID ${testId} not found`);
      }

      if (test.status !== ABTestStatus.DRAFT) {
        throw new BadRequestException('A/B test can only be started from DRAFT status');
      }

      test.status = ABTestStatus.RUNNING;
      test.startedAt = new Date();
      test.updatedAt = new Date();

      const updatedTest = await this.abTestRepository.save(test);
      
      // Start monitoring
      this.eventEmitter.emit('abtest.started', { testId, test: updatedTest });
      
      this.logger.log(`Started A/B test: ${testId}`);
      return updatedTest;
    } catch (error) {
      this.logger.error(`Failed to start A/B test ${testId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getModelPerformance(modelId: string, days: number = 30): Promise<any> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}:performance:${modelId}:${days}`;
      const cached = await this.cacheManager.get(cacheKey);
      
      if (cached) {
        return cached;
      }

      const performance = await this.monitoringService.getModelPerformance(modelId, days);
      
      // Cache the result
      await this.cacheManager.set(cacheKey, performance, this.CACHE_TTL);
      
      return performance;
    } catch (error) {
      this.logger.error(`Failed to get performance for model ${modelId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getModelDrift(modelId: string): Promise<any> {
    try {
      return await this.monitoringService.detectModelDrift(modelId);
    } catch (error) {
      this.logger.error(`Failed to detect drift for model ${modelId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async rollbackModel(modelId: string, versionId: string): Promise<any> {
    try {
      const model = await this.findModelById(modelId);
      const version = await this.versioningService.getVersion(versionId);

      if (version.modelId !== modelId) {
        throw new BadRequestException('Version does not belong to the specified model');
      }

      const rollback = await this.deploymentService.rollbackToVersion(model, version);
      
      this.logger.log(`Rolled back model ${modelId} to version ${versionId}`);
      return rollback;
    } catch (error) {
      this.logger.error(`Failed to rollback model ${modelId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getModelStatistics(): Promise<any> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}:statistics`;
      const cached = await this.cacheManager.get(cacheKey);
      
      if (cached) {
        return cached;
      }

      const [
        totalModels,
        deployedModels,
        trainingModels,
        draftModels,
        totalVersions,
        totalDeployments,
        activeTests
      ] = await Promise.all([
        this.modelRepository.count(),
        this.modelRepository.count({ where: { status: ModelStatus.DEPLOYED } }),
        this.modelRepository.count({ where: { status: ModelStatus.TRAINING } }),
        this.modelRepository.count({ where: { status: ModelStatus.DRAFT } }),
        this.versionRepository.count(),
        this.deploymentRepository.count({ where: { status: DeploymentStatus.ACTIVE } }),
        this.abTestRepository.count({ where: { status: ABTestStatus.RUNNING } })
      ]);

      const statistics = {
        totalModels,
        deployedModels,
        trainingModels,
        draftModels,
        totalVersions,
        totalDeployments,
        activeTests,
        deploymentRate: totalModels > 0 ? (deployedModels / totalModels) * 100 : 0,
        averageVersionsPerModel: totalModels > 0 ? totalVersions / totalModels : 0,
      };

      // Cache the result
      await this.cacheManager.set(cacheKey, statistics, this.CACHE_TTL);
      
      return statistics;
    } catch (error) {
      this.logger.error(`Failed to get model statistics: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Private helper methods
  private buildModelQuery(
    status?: ModelStatus,
    type?: ModelType,
    framework?: ModelFramework,
    search?: string
  ): QueryBuilder<MLModel> {
    const query = this.modelRepository.createQueryBuilder('model')
      .leftJoinAndSelect('model.versions', 'versions')
      .leftJoinAndSelect('model.deployments', 'deployments')
      .leftJoinAndSelect('model.performances', 'performances');

    if (status) {
      query.andWhere('model.status = :status', { status });
    }
    if (type) {
      query.andWhere('model.type = :type', { type });
    }
    if (framework) {
      query.andWhere('model.framework = :framework', { framework });
    }
    if (search) {
      query.andWhere(
        '(model.name ILIKE :search OR model.description ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    return query;
  }

  private async clearModelCache(modelId?: string): Promise<void> {
    if (modelId) {
      await this.cacheManager.del(`${this.CACHE_PREFIX}:${modelId}`);
    }
    
    // Clear list cache patterns
    const keys = await this.cacheManager.store.keys(`${this.CACHE_PREFIX}:list:*`);
    if (keys.length > 0) {
      await Promise.all(keys.map(key => this.cacheManager.del(key)));
    }
    
    // Clear statistics cache
    await this.cacheManager.del(`${this.CACHE_PREFIX}:statistics`);
  }

  private generateVersionNumber(model: MLModel): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `v${model.versions?.length + 1 || 1}.${timestamp}.${random}`;
  }
} 