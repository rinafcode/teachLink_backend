import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MLModelsModule } from './ml-models.module';
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

describe('MLModelsService - Integration Tests', () => {
  let module: TestingModule;
  let mlModelsService: MLModelsService;
  let versioningService: ModelVersioningService;
  let deploymentService: ModelDeploymentService;
  let monitoringService: ModelMonitoringService;
  let trainingService: TrainingPipelineService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => ({
            type: 'postgres',
            host: configService.get('DB_HOST', 'localhost'),
            port: configService.get('DB_PORT', 5432),
            username: configService.get('DB_USERNAME', 'test'),
            password: configService.get('DB_PASSWORD', 'test'),
            database: configService.get('DB_DATABASE', 'teachlink_test'),
            entities: [MLModel, ModelVersion, ModelDeployment, ModelPerformance, ABTest],
            synchronize: true,
            dropSchema: true,
          }),
          inject: [ConfigService],
        }),
        CacheModule.register({
          isGlobal: true,
          ttl: 300,
        }),
        EventEmitterModule.forRoot(),
        MLModelsModule,
      ],
    }).compile();

    mlModelsService = module.get<MLModelsService>(MLModelsService);
    versioningService = module.get<ModelVersioningService>(ModelVersioningService);
    deploymentService = module.get<ModelDeploymentService>(ModelDeploymentService);
    monitoringService = module.get<ModelMonitoringService>(ModelMonitoringService);
    trainingService = module.get<TrainingPipelineService>(TrainingPipelineService);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('Complete ML Model Lifecycle', () => {
    let createdModel: MLModel;
    let createdVersion: ModelVersion;
    let createdDeployment: ModelDeployment;
    let createdABTest: ABTest;

    it('should create a new ML model', async () => {
      const createModelDto: CreateModelDto = {
        name: 'Integration Test Model',
        description: 'A model for integration testing',
        type: ModelType.CLASSIFICATION,
        framework: ModelFramework.SCIKIT_LEARN,
        hyperparameters: {
          n_estimators: 100,
          max_depth: 10,
          random_state: 42,
        },
        features: ['feature1', 'feature2', 'feature3'],
        targetVariable: 'target',
        metadata: {
          version: '1.0.0',
          author: 'test-user',
          description: 'Integration test model',
        },
        createdBy: 'test-user',
      };

      createdModel = await mlModelsService.createModel(createModelDto);

      expect(createdModel).toBeDefined();
      expect(createdModel.id).toBeDefined();
      expect(createdModel.name).toBe(createModelDto.name);
      expect(createdModel.type).toBe(ModelType.CLASSIFICATION);
      expect(createdModel.framework).toBe(ModelFramework.SCIKIT_LEARN);
      expect(createdModel.status).toBe(ModelStatus.DRAFT);
      expect(createdModel.hyperparameters).toEqual(createModelDto.hyperparameters);
      expect(createdModel.features).toEqual(createModelDto.features);
      expect(createdModel.targetVariable).toBe(createModelDto.targetVariable);
    });

    it('should retrieve the created model by ID', async () => {
      const retrievedModel = await mlModelsService.findModelById(createdModel.id);

      expect(retrievedModel).toBeDefined();
      expect(retrievedModel.id).toBe(createdModel.id);
      expect(retrievedModel.name).toBe(createdModel.name);
    });

    it('should list models with pagination and filters', async () => {
      const result = await mlModelsService.findAllModels(1, 10, ModelStatus.DRAFT);

      expect(result).toBeDefined();
      expect(result.models).toBeInstanceOf(Array);
      expect(result.total).toBeGreaterThan(0);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBeGreaterThan(0);
      expect(result.models.some(model => model.id === createdModel.id)).toBe(true);
    });

    it('should start model training', async () => {
      const trainModelDto: TrainModelDto = {
        trainingDataPath: '/path/to/test/data.csv',
        validationSplit: 0.2,
        testSplit: 0.1,
        enableHyperparameterOptimization: true,
        maxTrials: 5,
        crossValidationFolds: 3,
        enableEarlyStopping: true,
        randomState: 42,
        description: 'Integration test training',
        preprocessing: {
          scaling: 'standard',
          encoding: 'label',
        },
        augmentation: {
          enabled: false,
        },
      };

      const trainingResult = await mlModelsService.trainModel(createdModel.id, trainModelDto);

      expect(trainingResult).toBeDefined();
      expect(trainingResult.modelId).toBe(createdModel.id);
      expect(trainingResult.status).toBe('training_started');
      expect(trainingResult.message).toContain('Training has been initiated');
    });

    it('should create a model version after training', async () => {
      // Simulate training completion by creating a version
      createdVersion = await versioningService.createVersion(
        createdModel.id,
        'v1.0.0',
        'Initial version from integration test',
      );

      expect(createdVersion).toBeDefined();
      expect(createdVersion.modelId).toBe(createdModel.id);
      expect(createdVersion.version).toBe('v1.0.0');
      expect(createdVersion.status).toBe(VersionStatus.DRAFT);
    });

    it('should update model version status to ready', async () => {
      const updatedVersion = await versioningService.updateVersion(createdVersion.id, {
        status: VersionStatus.READY,
        artifactPath: '/path/to/model/artifact.pkl',
        modelHash: 'abc123def456',
        trainingMetrics: {
          accuracy: 0.85,
          precision: 0.83,
          recall: 0.87,
          f1_score: 0.85,
        },
        validationMetrics: {
          accuracy: 0.83,
          precision: 0.81,
          recall: 0.85,
          f1_score: 0.83,
        },
        hyperparameters: {
          n_estimators: 100,
          max_depth: 10,
          random_state: 42,
        },
      });

      expect(updatedVersion.status).toBe(VersionStatus.READY);
      expect(updatedVersion.artifactPath).toBeDefined();
      expect(updatedVersion.modelHash).toBeDefined();
      expect(updatedVersion.trainingMetrics).toBeDefined();
    });

    it('should update model status to trained', async () => {
      const updatedModel = await mlModelsService.updateModel(createdModel.id, {
        status: ModelStatus.TRAINED,
        currentAccuracy: 0.85,
        currentPrecision: 0.83,
        currentRecall: 0.87,
        currentF1Score: 0.85,
        trainingMetrics: {
          accuracy: 0.85,
          precision: 0.83,
          recall: 0.87,
          f1_score: 0.85,
        },
        validationMetrics: {
          accuracy: 0.83,
          precision: 0.81,
          recall: 0.85,
          f1_score: 0.83,
        },
        lastTrainedAt: new Date(),
      });

      expect(updatedModel.status).toBe(ModelStatus.TRAINED);
      expect(updatedModel.currentAccuracy).toBe(0.85);
      expect(updatedModel.lastTrainedAt).toBeDefined();
    });

    it('should deploy the trained model', async () => {
      const deployModelDto: DeployModelDto = {
        environment: 'staging',
        deploymentConfig: {
          resources: {
            memory: '1Gi',
            cpu: '0.5',
          },
          replicas: 2,
          timeout: 30,
        },
        healthCheckConfig: {
          endpoint: '/health',
          interval: 30,
          timeout: 10,
          retries: 3,
          successThreshold: 1,
          failureThreshold: 3,
        },
        scalingConfig: {
          minReplicas: 1,
          maxReplicas: 10,
          targetCPUUtilization: 70,
          targetMemoryUtilization: 80,
          scaleUpCooldown: 300,
          scaleDownCooldown: 300,
        },
        monitoringConfig: {
          enableMetrics: true,
          enableLogging: true,
          enableTracing: true,
          alertThresholds: {
            cpu: 80,
            memory: 85,
            errorRate: 5,
            latency: 1000,
          },
        },
      };

      createdDeployment = await mlModelsService.deployModel(createdModel.id, deployModelDto);

      expect(createdDeployment).toBeDefined();
      expect(createdDeployment.modelId).toBe(createdModel.id);
      expect(createdDeployment.versionId).toBe(createdVersion.id);
      expect(createdDeployment.environment).toBe('staging');
      expect(createdDeployment.status).toBe(DeploymentStatus.ACTIVE);
      expect(createdDeployment.endpoint).toBeDefined();
    });

    it('should record model predictions and performance metrics', async () => {
      // Record some predictions
      await monitoringService.recordPrediction(
        createdModel.id,
        { prediction: 1, confidence: 0.95 },
        { actual: 1 },
        { requestId: 'req-1', timestamp: new Date() }
      );

      await monitoringService.recordPrediction(
        createdModel.id,
        { prediction: 0, confidence: 0.88 },
        { actual: 0 },
        { requestId: 'req-2', timestamp: new Date() }
      );

      // Record performance metrics
      await monitoringService.recordPerformanceMetrics(
        createdModel.id,
        {
          accuracy: 0.85,
          precision: 0.83,
          recall: 0.87,
          f1_score: 0.85,
          latency: 150,
          throughput: 100,
        },
        { batchSize: 100, timestamp: new Date() }
      );

      // Verify metrics are recorded
      const performance = await mlModelsService.getModelPerformance(createdModel.id, 1);
      expect(performance).toBeDefined();
      expect(performance.summary).toBeDefined();
    });

    it('should detect model drift', async () => {
      const driftResults = await mlModelsService.getModelDrift(createdModel.id);

      expect(driftResults).toBeDefined();
      expect(driftResults.modelId).toBe(createdModel.id);
      expect(driftResults.timestamp).toBeDefined();
      expect(driftResults.featureDrift).toBeDefined();
      expect(driftResults.labelDrift).toBeDefined();
      expect(driftResults.conceptDrift).toBeDefined();
      expect(driftResults.dataQualityDrift).toBeDefined();
      expect(driftResults.overallDriftScore).toBeDefined();
      expect(driftResults.severity).toBeDefined();
    });

    it('should create a second model for A/B testing', async () => {
      const createModelDto2: CreateModelDto = {
        name: 'Integration Test Model 2',
        description: 'Second model for A/B testing',
        type: ModelType.CLASSIFICATION,
        framework: ModelFramework.XGBOOST,
        hyperparameters: {
          n_estimators: 200,
          max_depth: 8,
          learning_rate: 0.1,
        },
        features: ['feature1', 'feature2', 'feature3'],
        targetVariable: 'target',
        createdBy: 'test-user',
      };

      const model2 = await mlModelsService.createModel(createModelDto2);
      
      // Update model 2 to trained and deployed status
      await mlModelsService.updateModel(model2.id, { status: ModelStatus.TRAINED });
      await mlModelsService.updateModel(createdModel.id, { status: ModelStatus.DEPLOYED });
      await mlModelsService.updateModel(model2.id, { status: ModelStatus.DEPLOYED });

      // Create A/B test
      const createABTestDto: CreateABTestDto = {
        name: 'Integration A/B Test',
        description: 'Testing model comparison in integration test',
        type: ABTestType.TRAFFIC_SPLIT,
        modelAId: createdModel.id,
        modelBId: model2.id,
        trafficSplit: 0.5,
        testConfig: {
          duration: 7,
          sampleSize: 1000,
        },
        successMetrics: ['accuracy', 'precision', 'recall', 'f1_score'],
        guardrailMetrics: ['latency', 'error_rate'],
        minSampleSize: 1000,
        maxDurationDays: 14,
        significanceLevel: 0.05,
        createdBy: 'test-user',
      };

      createdABTest = await mlModelsService.createABTest(createABTestDto);

      expect(createdABTest).toBeDefined();
      expect(createdABTest.modelAId).toBe(createdModel.id);
      expect(createdABTest.modelBId).toBe(model2.id);
      expect(createdABTest.status).toBe(ABTestStatus.DRAFT);
      expect(createdABTest.trafficSplit).toBe(0.5);
    });

    it('should start the A/B test', async () => {
      const startedTest = await mlModelsService.startABTest(createdABTest.id);

      expect(startedTest.status).toBe(ABTestStatus.RUNNING);
      expect(startedTest.startedAt).toBeDefined();
    });

    it('should get deployment status', async () => {
      const deploymentStatus = await deploymentService.getDeploymentStatus(createdDeployment.id);

      expect(deploymentStatus).toBeDefined();
      expect(deploymentStatus.deployment).toBeDefined();
      expect(deploymentStatus.health).toBeDefined();
      expect(deploymentStatus.metrics).toBeDefined();
      expect(deploymentStatus.uptime).toBeDefined();
    });

    it('should get model statistics', async () => {
      const statistics = await mlModelsService.getModelStatistics();

      expect(statistics).toBeDefined();
      expect(statistics.totalModels).toBeGreaterThan(0);
      expect(statistics.deployedModels).toBeGreaterThan(0);
      expect(statistics.totalVersions).toBeGreaterThan(0);
      expect(statistics.totalDeployments).toBeGreaterThan(0);
      expect(statistics.activeTests).toBeGreaterThan(0);
      expect(statistics.deploymentRate).toBeGreaterThan(0);
      expect(statistics.averageVersionsPerModel).toBeGreaterThan(0);
    });

    it('should perform model rollback', async () => {
      // Create a new version for rollback testing
      const newVersion = await versioningService.createVersion(
        createdModel.id,
        'v1.1.0',
        'New version for rollback test',
      );

      await versioningService.updateVersion(newVersion.id, {
        status: VersionStatus.READY,
        artifactPath: '/path/to/new/model/artifact.pkl',
        modelHash: 'xyz789',
      });

      const rollbackResult = await mlModelsService.rollbackModel(createdModel.id, newVersion.id);

      expect(rollbackResult).toBeDefined();
      expect(rollbackResult.modelId).toBe(createdModel.id);
      expect(rollbackResult.versionId).toBe(newVersion.id);
    });

    it('should undeploy the model', async () => {
      await mlModelsService.undeployModel(createdModel.id);

      // Verify deployment is marked as undeployed
      const deploymentStatus = await deploymentService.getDeploymentStatus(createdDeployment.id);
      expect(deploymentStatus.deployment.status).toBe(DeploymentStatus.UNDEPLOYED);
    });

    it('should delete the model', async () => {
      // First undeploy if still active
      await mlModelsService.undeployModel(createdModel.id);
      
      // Then delete
      await mlModelsService.deleteModel(createdModel.id);

      // Verify model is deleted
      await expect(mlModelsService.findModelById(createdModel.id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle duplicate model names gracefully', async () => {
      const createModelDto: CreateModelDto = {
        name: 'Duplicate Test Model',
        type: ModelType.CLASSIFICATION,
        framework: ModelFramework.SCIKIT_LEARN,
      };

      // Create first model
      await mlModelsService.createModel(createModelDto);

      // Try to create second model with same name
      await expect(mlModelsService.createModel(createModelDto)).rejects.toThrow(BadRequestException);
    });

    it('should handle training on already training model', async () => {
      const createModelDto: CreateModelDto = {
        name: 'Training Test Model',
        type: ModelType.CLASSIFICATION,
        framework: ModelFramework.SCIKIT_LEARN,
      };

      const model = await mlModelsService.createModel(createModelDto);
      
      // Update model to training status
      await mlModelsService.updateModel(model.id, { status: ModelStatus.TRAINING });

      // Try to start training again
      await expect(mlModelsService.trainModel(model.id, {} as TrainModelDto)).rejects.toThrow(BadRequestException);
    });

    it('should handle deployment of untrained model', async () => {
      const createModelDto: CreateModelDto = {
        name: 'Untrained Test Model',
        type: ModelType.CLASSIFICATION,
        framework: ModelFramework.SCIKIT_LEARN,
      };

      const model = await mlModelsService.createModel(createModelDto);

      // Try to deploy untrained model
      await expect(mlModelsService.deployModel(model.id, {} as DeployModelDto)).rejects.toThrow(BadRequestException);
    });

    it('should handle A/B test with undeployed models', async () => {
      const createModelDto: CreateModelDto = {
        name: 'Undeployed Test Model',
        type: ModelType.CLASSIFICATION,
        framework: ModelFramework.SCIKIT_LEARN,
      };

      const model1 = await mlModelsService.createModel(createModelDto);
      const model2 = await mlModelsService.createModel({
        ...createModelDto,
        name: 'Undeployed Test Model 2',
      });

      const createABTestDto: CreateABTestDto = {
        name: 'Undeployed A/B Test',
        type: ABTestType.TRAFFIC_SPLIT,
        modelAId: model1.id,
        modelBId: model2.id,
        trafficSplit: 0.5,
      };

      // Try to create A/B test with undeployed models
      await expect(mlModelsService.createABTest(createABTestDto)).rejects.toThrow(BadRequestException);
    });

    it('should handle invalid model ID gracefully', async () => {
      const invalidId = 'invalid-uuid-id';

      await expect(mlModelsService.findModelById(invalidId)).rejects.toThrow(NotFoundException);
      await expect(mlModelsService.updateModel(invalidId, {})).rejects.toThrow(NotFoundException);
      await expect(mlModelsService.deleteModel(invalidId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle bulk model operations efficiently', async () => {
      const models = [];
      const startTime = Date.now();

      // Create multiple models
      for (let i = 0; i < 10; i++) {
        const createModelDto: CreateModelDto = {
          name: `Bulk Test Model ${i}`,
          type: ModelType.CLASSIFICATION,
          framework: ModelFramework.SCIKIT_LEARN,
        };
        const model = await mlModelsService.createModel(createModelDto);
        models.push(model);
      }

      const creationTime = Date.now() - startTime;
      expect(creationTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Test bulk retrieval
      const retrievalStartTime = Date.now();
      const result = await mlModelsService.findAllModels(1, 20);
      const retrievalTime = Date.now() - retrievalStartTime;

      expect(result.models.length).toBeGreaterThanOrEqual(10);
      expect(retrievalTime).toBeLessThan(1000); // Should complete within 1 second

      // Cleanup
      for (const model of models) {
        await mlModelsService.deleteModel(model.id);
      }
    });

    it('should use caching effectively', async () => {
      const createModelDto: CreateModelDto = {
        name: 'Cache Test Model',
        type: ModelType.CLASSIFICATION,
        framework: ModelFramework.SCIKIT_LEARN,
      };

      const model = await mlModelsService.createModel(createModelDto);

      // First call should hit database
      const firstCallStart = Date.now();
      await mlModelsService.findModelById(model.id);
      const firstCallTime = Date.now() - firstCallStart;

      // Second call should hit cache
      const secondCallStart = Date.now();
      await mlModelsService.findModelById(model.id);
      const secondCallTime = Date.now() - secondCallStart;

      // Cache should be faster
      expect(secondCallTime).toBeLessThan(firstCallTime);

      // Cleanup
      await mlModelsService.deleteModel(model.id);
    });
  });
});
