import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    private readonly versioningService: ModelVersioningService,
    private readonly deploymentService: ModelDeploymentService,
    private readonly monitoringService: ModelMonitoringService,
    private readonly trainingService: TrainingPipelineService,
  ) {}

  async createModel(createModelDto: CreateModelDto): Promise<MLModel> {
    const model = this.modelRepository.create({
      ...createModelDto,
      status: ModelStatus.DRAFT,
    });
    return await this.modelRepository.save(model);
  }

  async findAllModels(
    page: number = 1,
    limit: number = 10,
    status?: ModelStatus,
    type?: ModelType,
    framework?: ModelFramework,
  ): Promise<{ models: MLModel[]; total: number }> {
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

    const total = await query.getCount();
    const models = await query
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('model.createdAt', 'DESC')
      .getMany();

    return { models, total };
  }

  async findModelById(id: string): Promise<MLModel> {
    const model = await this.modelRepository.findOne({
      where: { id },
      relations: ['versions', 'deployments', 'performances'],
    });

    if (!model) {
      throw new NotFoundException(`Model with ID ${id} not found`);
    }

    return model;
  }

  async updateModel(id: string, updateModelDto: UpdateModelDto): Promise<MLModel> {
    const model = await this.findModelById(id);
    
    Object.assign(model, updateModelDto);
    return await this.modelRepository.save(model);
  }

  async deleteModel(id: string): Promise<void> {
    const model = await this.findModelById(id);
    
    // Check if model has active deployments
    const activeDeployments = await this.deploymentRepository.count({
      where: { modelId: id, status: DeploymentStatus.ACTIVE },
    });

    if (activeDeployments > 0) {
      throw new BadRequestException('Cannot delete model with active deployments');
    }

    await this.modelRepository.remove(model);
  }

  async trainModel(trainModelDto: TrainModelDto): Promise<ModelVersion> {
    const model = await this.findModelById(trainModelDto.modelId);
    
    // Update model status to training
    model.status = ModelStatus.TRAINING;
    await this.modelRepository.save(model);

    try {
      // Create new version
      const version = this.versionRepository.create({
        modelId: model.id,
        version: trainModelDto.version || `v${Date.now()}`,
        description: trainModelDto.description,
        hyperparameters: trainModelDto.hyperparameters,
        trainingConfig: trainModelDto.trainingConfig,
        dataConfig: trainModelDto.dataConfig,
        parentVersionId: trainModelDto.parentVersionId,
        status: VersionStatus.TRAINING,
        createdBy: trainModelDto.trainedBy,
      });

      const savedVersion = await this.versionRepository.save(version);

      // Start training pipeline
      const trainingResult = await this.trainingService.trainModel(
        model,
        savedVersion,
        trainModelDto,
      );

      // Update version with training results
      savedVersion.status = VersionStatus.TRAINED;
      savedVersion.trainingMetrics = trainingResult.trainingMetrics;
      savedVersion.validationMetrics = trainingResult.validationMetrics;
      savedVersion.testMetrics = trainingResult.testMetrics;
      savedVersion.accuracy = trainingResult.accuracy;
      savedVersion.precision = trainingResult.precision;
      savedVersion.recall = trainingResult.recall;
      savedVersion.f1Score = trainingResult.f1Score;
      savedVersion.featureImportance = trainingResult.featureImportance;
      savedVersion.confusionMatrix = trainingResult.confusionMatrix;
      savedVersion.rocCurve = trainingResult.rocCurve;
      savedVersion.artifactPath = trainingResult.artifactPath;
      savedVersion.modelHash = trainingResult.modelHash;
      savedVersion.trainedAt = new Date();

      const updatedVersion = await this.versionRepository.save(savedVersion);

      // Update model with latest metrics
      model.status = ModelStatus.TRAINED;
      model.currentAccuracy = trainingResult.accuracy;
      model.currentPrecision = trainingResult.precision;
      model.currentRecall = trainingResult.recall;
      model.currentF1Score = trainingResult.f1Score;
      model.trainingMetrics = trainingResult.trainingMetrics;
      model.validationMetrics = trainingResult.validationMetrics;
      model.lastTrainedAt = new Date();
      model.artifactPath = trainingResult.artifactPath;
      model.modelHash = trainingResult.modelHash;

      await this.modelRepository.save(model);

      return updatedVersion;
    } catch (error) {
      // Update model status to failed
      model.status = ModelStatus.FAILED;
      await this.modelRepository.save(model);
      throw error;
    }
  }

  async deployModel(deployModelDto: DeployModelDto): Promise<ModelDeployment> {
    const model = await this.findModelById(deployModelDto.modelId);
    const version = await this.versionRepository.findOne({
      where: { id: deployModelDto.versionId, modelId: deployModelDto.modelId },
    });

    if (!version) {
      throw new NotFoundException('Model version not found');
    }

    if (version.status !== VersionStatus.TRAINED && version.status !== VersionStatus.VALIDATED) {
      throw new BadRequestException('Model version must be trained or validated before deployment');
    }

    // Create deployment record
    const deployment = this.deploymentRepository.create({
      modelId: model.id,
      versionId: version.id,
      name: deployModelDto.name || `${model.name}-${version.version}`,
      description: deployModelDto.description,
      environment: deployModelDto.environment,
      status: DeploymentStatus.PENDING,
      deploymentConfig: deployModelDto.deploymentConfig,
      scalingConfig: deployModelDto.scalingConfig,
      healthCheckConfig: deployModelDto.healthCheckConfig,
      deployedBy: deployModelDto.deployedBy,
    });

    const savedDeployment = await this.deploymentRepository.save(deployment);

    try {
      // Deploy model using deployment service
      const deploymentResult = await this.deploymentService.deployModel(
        model,
        version,
        savedDeployment,
        deployModelDto,
      );

      // Update deployment with results
      savedDeployment.status = DeploymentStatus.ACTIVE;
      savedDeployment.endpoint = deploymentResult.endpoint;
      savedDeployment.serviceUrl = deploymentResult.serviceUrl;
      savedDeployment.deployedAt = new Date();
      savedDeployment.activatedAt = new Date();

      const updatedDeployment = await this.deploymentRepository.save(savedDeployment);

      // Update model status
      model.status = ModelStatus.DEPLOYED;
      model.lastDeployedAt = new Date();
      await this.modelRepository.save(model);

      return updatedDeployment;
    } catch (error) {
      // Update deployment status to failed
      savedDeployment.status = DeploymentStatus.FAILED;
      savedDeployment.failureReason = error.message;
      await this.deploymentRepository.save(savedDeployment);
      throw error;
    }
  }

  async rollbackDeployment(deploymentId: string, rollbackToDeploymentId: string): Promise<ModelDeployment> {
    const currentDeployment = await this.deploymentRepository.findOne({
      where: { id: deploymentId },
      relations: ['model', 'version'],
    });

    if (!currentDeployment) {
      throw new NotFoundException('Deployment not found');
    }

    const rollbackDeployment = await this.deploymentRepository.findOne({
      where: { id: rollbackToDeploymentId },
      relations: ['model', 'version'],
    });

    if (!rollbackDeployment) {
      throw new NotFoundException('Rollback deployment not found');
    }

    try {
      // Perform rollback using deployment service
      await this.deploymentService.rollbackModel(
        currentDeployment,
        rollbackDeployment,
      );

      // Update current deployment status
      currentDeployment.status = DeploymentStatus.ROLLED_BACK;
      currentDeployment.rolledBackAt = new Date();
      currentDeployment.rollbackToDeploymentId = rollbackToDeploymentId;

      // Activate rollback deployment
      rollbackDeployment.status = DeploymentStatus.ACTIVE;
      rollbackDeployment.activatedAt = new Date();

      await this.deploymentRepository.save([currentDeployment, rollbackDeployment]);

      return rollbackDeployment;
    } catch (error) {
      throw new BadRequestException(`Rollback failed: ${error.message}`);
    }
  }

  async getModelPerformance(modelId: string, days: number = 30): Promise<ModelPerformance[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return await this.performanceRepository.find({
      where: {
        modelId,
        recordedAt: startDate,
      },
      order: { recordedAt: 'ASC' },
    });
  }

  async createABTest(createABTestDto: CreateABTestDto): Promise<ABTest> {
    // Validate that both models exist and are deployed
    const modelA = await this.findModelById(createABTestDto.modelAId);
    const modelB = await this.findModelById(createABTestDto.modelBId);

    if (modelA.status !== ModelStatus.DEPLOYED || modelB.status !== ModelStatus.DEPLOYED) {
      throw new BadRequestException('Both models must be deployed for A/B testing');
    }

    const abTest = this.abTestRepository.create({
      ...createABTestDto,
      status: ABTestStatus.DRAFT,
    });

    return await this.abTestRepository.save(abTest);
  }

  async startABTest(abTestId: string): Promise<ABTest> {
    const abTest = await this.abTestRepository.findOne({
      where: { id: abTestId },
      relations: ['modelA', 'modelB'],
    });

    if (!abTest) {
      throw new NotFoundException('A/B test not found');
    }

    if (abTest.status !== ABTestStatus.DRAFT) {
      throw new BadRequestException('A/B test can only be started from draft status');
    }

    abTest.status = ABTestStatus.RUNNING;
    abTest.startedAt = new Date();
    abTest.scheduledEndAt = abTest.maxDurationDays 
      ? new Date(Date.now() + abTest.maxDurationDays * 24 * 60 * 60 * 1000)
      : null;

    return await this.abTestRepository.save(abTest);
  }

  async stopABTest(abTestId: string, stopReason: string): Promise<ABTest> {
    const abTest = await this.abTestRepository.findOne({
      where: { id: abTestId },
    });

    if (!abTest) {
      throw new NotFoundException('A/B test not found');
    }

    if (abTest.status !== ABTestStatus.RUNNING) {
      throw new BadRequestException('A/B test is not running');
    }

    // Calculate final results
    const results = await this.calculateABTestResults(abTest);

    abTest.status = ABTestStatus.COMPLETED;
    abTest.endedAt = new Date();
    abTest.results = results;
    abTest.winnerModelId = results.winner;
    abTest.isStatisticallySignificant = results.isStatisticallySignificant;
    abTest.confidenceLevel = results.confidenceLevel;
    abTest.stopReason = stopReason;

    return await this.abTestRepository.save(abTest);
  }

  private async calculateABTestResults(abTest: ABTest): Promise<any> {
    // This is a simplified implementation
    // In a real scenario, you would collect actual metrics from both models
    const modelAMetrics = {
      accuracy: 0.95,
      precision: 0.94,
      recall: 0.93,
      f1Score: 0.935,
    };

    const modelBMetrics = {
      accuracy: 0.93,
      precision: 0.92,
      recall: 0.91,
      f1Score: 0.915,
    };

    // Simple comparison based on F1 score
    const winner = modelAMetrics.f1Score > modelBMetrics.f1Score ? abTest.modelAId : abTest.modelBId;
    const isStatisticallySignificant = Math.abs(modelAMetrics.f1Score - modelBMetrics.f1Score) > 0.01;
    const confidenceLevel = 0.95;

    return {
      winner,
      isStatisticallySignificant,
      confidenceLevel,
      modelAMetrics,
      modelBMetrics,
    };
  }

  async getModelLineage(modelId: string): Promise<any> {
    const model = await this.findModelById(modelId);
    const versions = await this.versionRepository.find({
      where: { modelId },
      order: { createdAt: 'ASC' },
    });

    const deployments = await this.deploymentRepository.find({
      where: { modelId },
      order: { createdAt: 'ASC' },
    });

    return {
      model,
      versions,
      deployments,
      lineage: this.buildLineageGraph(versions, deployments),
    };
  }

  private buildLineageGraph(versions: ModelVersion[], deployments: ModelDeployment[]): any {
    // Build a graph representation of model lineage
    const nodes = [];
    const edges = [];

    // Add model versions as nodes
    versions.forEach(version => {
      nodes.push({
        id: version.id,
        type: 'version',
        label: version.version,
        status: version.status,
        metrics: {
          accuracy: version.accuracy,
          f1Score: version.f1Score,
        },
      });

      // Add edges for parent-child relationships
      if (version.parentVersionId) {
        edges.push({
          from: version.parentVersionId,
          to: version.id,
          type: 'parent-child',
        });
      }
    });

    // Add deployments as nodes
    deployments.forEach(deployment => {
      nodes.push({
        id: deployment.id,
        type: 'deployment',
        label: deployment.name,
        status: deployment.status,
        environment: deployment.environment,
      });

      // Add edges for version-deployment relationships
      edges.push({
        from: deployment.versionId,
        to: deployment.id,
        type: 'version-deployment',
      });
    });

    return { nodes, edges };
  }
} 