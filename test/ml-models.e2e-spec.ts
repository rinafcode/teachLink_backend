import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { MLModelsModule } from '../src/ml-models/ml-models.module';
import { MLModel } from '../src/ml-models/entities/ml-model.entity';
import { ModelVersion } from '../src/ml-models/entities/model-version.entity';
import { ModelDeployment } from '../src/ml-models/entities/model-deployment.entity';
import { ABTest } from '../src/ml-models/entities/ab-test.entity';
import { ModelType, ModelFramework, ModelStatus, VersionStatus, DeploymentStatus, DeploymentEnvironment, ABTestStatus, ABTestType } from '../src/ml-models/enums';

describe('ML Models (e2e)', () => {
  let app: INestApplication;
  let createdModelId: string;
  let createdVersionId: string;
  let createdDeploymentId: string;
  let createdABTestId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [MLModel, ModelVersion, ModelDeployment, ABTest],
          synchronize: true,
        }),
        MLModelsModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/ml-models (POST)', () => {
    it('should create a new ML model', () => {
      const createModelDto = {
        name: 'Test Classification Model',
        description: 'A test classification model for e2e testing',
        type: ModelType.CLASSIFICATION,
        framework: ModelFramework.SCIKIT_LEARN,
        hyperparameters: {
          max_depth: 10,
          n_estimators: 100,
          random_state: 42,
        },
        features: ['feature1', 'feature2', 'feature3'],
        targetVariable: 'target',
        metadata: {
          dataset: 'test_dataset',
          version: '1.0.0',
        },
        createdBy: 'test-user',
      };

      return request(app.getHttpServer())
        .post('/ml-models')
        .send(createModelDto)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toBe(createModelDto.name);
          expect(res.body.type).toBe(createModelDto.type);
          expect(res.body.framework).toBe(createModelDto.framework);
          expect(res.body.status).toBe(ModelStatus.DRAFT);
          expect(res.body.hyperparameters).toEqual(createModelDto.hyperparameters);
          expect(res.body.features).toEqual(createModelDto.features);
          expect(res.body.targetVariable).toBe(createModelDto.targetVariable);
          expect(res.body.metadata).toEqual(createModelDto.metadata);
          expect(res.body.createdBy).toBe(createModelDto.createdBy);
          
          createdModelId = res.body.id;
        });
    });

    it('should validate required fields', () => {
      const invalidModelDto = {
        description: 'Missing required fields',
      };

      return request(app.getHttpServer())
        .post('/ml-models')
        .send(invalidModelDto)
        .expect(400);
    });

    it('should validate enum values', () => {
      const invalidModelDto = {
        name: 'Invalid Model',
        type: 'invalid_type',
        framework: 'invalid_framework',
      };

      return request(app.getHttpServer())
        .post('/ml-models')
        .send(invalidModelDto)
        .expect(400);
    });
  });

  describe('/ml-models (GET)', () => {
    it('should get all models with pagination', () => {
      return request(app.getHttpServer())
        .get('/ml-models?page=1&limit=10')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('models');
          expect(res.body).toHaveProperty('total');
          expect(Array.isArray(res.body.models)).toBe(true);
          expect(typeof res.body.total).toBe('number');
        });
    });

    it('should filter models by status', () => {
      return request(app.getHttpServer())
        .get('/ml-models?status=draft')
        .expect(200)
        .expect((res) => {
          expect(res.body.models.every((model: any) => model.status === 'draft')).toBe(true);
        });
    });

    it('should filter models by type', () => {
      return request(app.getHttpServer())
        .get('/ml-models?type=classification')
        .expect(200)
        .expect((res) => {
          expect(res.body.models.every((model: any) => model.type === 'classification')).toBe(true);
        });
    });

    it('should filter models by framework', () => {
      return request(app.getHttpServer())
        .get('/ml-models?framework=scikit-learn')
        .expect(200)
        .expect((res) => {
          expect(res.body.models.every((model: any) => model.framework === 'scikit-learn')).toBe(true);
        });
    });
  });

  describe('/ml-models/:id (GET)', () => {
    it('should get a specific model by ID', () => {
      return request(app.getHttpServer())
        .get(`/ml-models/${createdModelId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(createdModelId);
          expect(res.body.name).toBe('Test Classification Model');
          expect(res.body.type).toBe('classification');
          expect(res.body.framework).toBe('scikit-learn');
        });
    });

    it('should return 404 for non-existent model', () => {
      return request(app.getHttpServer())
        .get('/ml-models/non-existent-id')
        .expect(404);
    });
  });

  describe('/ml-models/:id (PUT)', () => {
    it('should update a model', () => {
      const updateModelDto = {
        name: 'Updated Test Model',
        description: 'Updated description',
        hyperparameters: {
          max_depth: 15,
          n_estimators: 200,
          random_state: 42,
        },
      };

      return request(app.getHttpServer())
        .put(`/ml-models/${createdModelId}`)
        .send(updateModelDto)
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe(updateModelDto.name);
          expect(res.body.description).toBe(updateModelDto.description);
          expect(res.body.hyperparameters).toEqual(updateModelDto.hyperparameters);
        });
    });

    it('should return 404 for non-existent model', () => {
      const updateModelDto = {
        name: 'Updated Model',
      };

      return request(app.getHttpServer())
        .put('/ml-models/non-existent-id')
        .send(updateModelDto)
        .expect(404);
    });
  });

  describe('/ml-models/:id/train (POST)', () => {
    it('should train a model', () => {
      const trainModelDto = {
        modelId: createdModelId,
        version: 'v1.0.0',
        description: 'Initial training run',
        hyperparameters: {
          max_depth: 10,
          n_estimators: 100,
          learning_rate: 0.1,
        },
        trainingConfig: {
          epochs: 100,
          batchSize: 32,
          learningRate: 0.001,
          validationSplit: 0.2,
          earlyStopping: true,
          patience: 10,
        },
        dataConfig: {
          trainingDataPath: '/data/train.csv',
          validationDataPath: '/data/val.csv',
          testDataPath: '/data/test.csv',
          dataPreprocessing: {
            scaling: 'standard',
            encoding: 'one_hot',
          },
        },
        trainedBy: 'test-user',
      };

      return request(app.getHttpServer())
        .post(`/ml-models/${createdModelId}/train`)
        .send(trainModelDto)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.modelId).toBe(createdModelId);
          expect(res.body.version).toBe('v1.0.0');
          expect(res.body.status).toBe(VersionStatus.TRAINED);
          expect(res.body.hyperparameters).toEqual(trainModelDto.hyperparameters);
          expect(res.body.trainingConfig).toEqual(trainModelDto.trainingConfig);
          expect(res.body.dataConfig).toEqual(trainModelDto.dataConfig);
          expect(res.body.trainedAt).toBeDefined();
          
          createdVersionId = res.body.id;
        });
    });

    it('should return 404 for non-existent model', () => {
      const trainModelDto = {
        modelId: 'non-existent-id',
        version: 'v1.0.0',
      };

      return request(app.getHttpServer())
        .post('/ml-models/non-existent-id/train')
        .send(trainModelDto)
        .expect(404);
    });
  });

  describe('/ml-models/:id/deploy (POST)', () => {
    it('should deploy a model', () => {
      const deployModelDto = {
        modelId: createdModelId,
        versionId: createdVersionId,
        name: 'Production Deployment',
        description: 'Production deployment for the test model',
        environment: DeploymentEnvironment.PRODUCTION,
        deploymentConfig: {
          replicas: 3,
          resources: {
            cpu: '1000m',
            memory: '2Gi',
          },
          autoscaling: {
            minReplicas: 2,
            maxReplicas: 10,
            targetCPUUtilization: 70,
          },
        },
        scalingConfig: {
          minReplicas: 2,
          maxReplicas: 10,
          targetCPUUtilization: 70,
          targetMemoryUtilization: 80,
        },
        healthCheckConfig: {
          path: '/health',
          initialDelaySeconds: 30,
          periodSeconds: 10,
          timeoutSeconds: 5,
          failureThreshold: 3,
        },
        deployedBy: 'test-user',
      };

      return request(app.getHttpServer())
        .post(`/ml-models/${createdModelId}/deploy`)
        .send(deployModelDto)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.modelId).toBe(createdModelId);
          expect(res.body.versionId).toBe(createdVersionId);
          expect(res.body.name).toBe('Production Deployment');
          expect(res.body.environment).toBe(DeploymentEnvironment.PRODUCTION);
          expect(res.body.status).toBe(DeploymentStatus.ACTIVE);
          expect(res.body.deploymentConfig).toEqual(deployModelDto.deploymentConfig);
          expect(res.body.scalingConfig).toEqual(deployModelDto.scalingConfig);
          expect(res.body.healthCheckConfig).toEqual(deployModelDto.healthCheckConfig);
          expect(res.body.deployedAt).toBeDefined();
          expect(res.body.activatedAt).toBeDefined();
          
          createdDeploymentId = res.body.id;
        });
    });

    it('should return 404 for non-existent model', () => {
      const deployModelDto = {
        modelId: 'non-existent-id',
        versionId: 'non-existent-version',
        environment: DeploymentEnvironment.PRODUCTION,
      };

      return request(app.getHttpServer())
        .post('/ml-models/non-existent-id/deploy')
        .send(deployModelDto)
        .expect(404);
    });
  });

  describe('/ml-models/:id/performance (GET)', () => {
    it('should get model performance metrics', () => {
      return request(app.getHttpServer())
        .get(`/ml-models/${createdModelId}/performance?days=30`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should return 404 for non-existent model', () => {
      return request(app.getHttpServer())
        .get('/ml-models/non-existent-id/performance')
        .expect(404);
    });
  });

  describe('/ml-models/:id/lineage (GET)', () => {
    it('should get model lineage', () => {
      return request(app.getHttpServer())
        .get(`/ml-models/${createdModelId}/lineage`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('model');
          expect(res.body).toHaveProperty('versions');
          expect(res.body).toHaveProperty('deployments');
          expect(res.body).toHaveProperty('lineage');
          expect(res.body.model.id).toBe(createdModelId);
        });
    });

    it('should return 404 for non-existent model', () => {
      return request(app.getHttpServer())
        .get('/ml-models/non-existent-id/lineage')
        .expect(404);
    });
  });

  describe('/ml-models/ab-tests (POST)', () => {
    it('should create an A/B test', () => {
      // First, create a second model for A/B testing
      const secondModelDto = {
        name: 'Test Model B',
        description: 'Second model for A/B testing',
        type: ModelType.CLASSIFICATION,
        framework: ModelFramework.SCIKIT_LEARN,
        hyperparameters: { max_depth: 8 },
        features: ['feature1', 'feature2'],
        targetVariable: 'target',
        createdBy: 'test-user',
      };

      return request(app.getHttpServer())
        .post('/ml-models')
        .send(secondModelDto)
        .expect(201)
        .then((res) => {
          const secondModelId = res.body.id;

          // Deploy the second model
          const deploySecondModelDto = {
            modelId: secondModelId,
            versionId: createdVersionId, // Reuse the same version for simplicity
            name: 'Model B Deployment',
            environment: DeploymentEnvironment.PRODUCTION,
            deployedBy: 'test-user',
          };

          return request(app.getHttpServer())
            .post(`/ml-models/${secondModelId}/deploy`)
            .send(deploySecondModelDto)
            .expect(201)
            .then(() => {
              // Create A/B test
              const createABTestDto = {
                name: 'Test A/B Test',
                description: 'Testing two classification models',
                type: ABTestType.TRAFFIC_SPLIT,
                modelAId: createdModelId,
                modelBId: secondModelId,
                trafficSplit: 0.5,
                testConfig: {
                  duration: '7d',
                  successMetrics: ['accuracy', 'f1_score'],
                  guardrailMetrics: ['latency', 'error_rate'],
                },
                successMetrics: ['accuracy', 'f1_score'],
                guardrailMetrics: ['latency', 'error_rate'],
                minSampleSize: 1000,
                maxDurationDays: 7,
                significanceLevel: 0.05,
                createdBy: 'test-user',
              };

              return request(app.getHttpServer())
                .post('/ml-models/ab-tests')
                .send(createABTestDto)
                .expect(201)
                .expect((abTestRes) => {
                  expect(abTestRes.body).toHaveProperty('id');
                  expect(abTestRes.body.name).toBe(createABTestDto.name);
                  expect(abTestRes.body.type).toBe(ABTestType.TRAFFIC_SPLIT);
                  expect(abTestRes.body.modelAId).toBe(createdModelId);
                  expect(abTestRes.body.modelBId).toBe(secondModelId);
                  expect(abTestRes.body.trafficSplit).toBe(0.5);
                  expect(abTestRes.body.status).toBe(ABTestStatus.DRAFT);
                  expect(abTestRes.body.testConfig).toEqual(createABTestDto.testConfig);
                  expect(abTestRes.body.successMetrics).toEqual(createABTestDto.successMetrics);
                  expect(abTestRes.body.guardrailMetrics).toEqual(createABTestDto.guardrailMetrics);
                  
                  createdABTestId = abTestRes.body.id;
                });
            });
        });
    });

    it('should validate A/B test creation', () => {
      const invalidABTestDto = {
        name: 'Invalid A/B Test',
        type: 'invalid_type',
      };

      return request(app.getHttpServer())
        .post('/ml-models/ab-tests')
        .send(invalidABTestDto)
        .expect(400);
    });
  });

  describe('/ml-models/ab-tests/:id/start (POST)', () => {
    it('should start an A/B test', () => {
      return request(app.getHttpServer())
        .post(`/ml-models/ab-tests/${createdABTestId}/start`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(createdABTestId);
          expect(res.body.status).toBe(ABTestStatus.RUNNING);
          expect(res.body.startedAt).toBeDefined();
        });
    });

    it('should return 404 for non-existent A/B test', () => {
      return request(app.getHttpServer())
        .post('/ml-models/ab-tests/non-existent-id/start')
        .expect(404);
    });
  });

  describe('/ml-models/ab-tests/:id/stop (POST)', () => {
    it('should stop an A/B test', () => {
      const stopReason = 'Test completed successfully';

      return request(app.getHttpServer())
        .post(`/ml-models/ab-tests/${createdABTestId}/stop`)
        .send({ stopReason })
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(createdABTestId);
          expect(res.body.status).toBe(ABTestStatus.COMPLETED);
          expect(res.body.endedAt).toBeDefined();
          expect(res.body.stopReason).toBe(stopReason);
          expect(res.body.results).toBeDefined();
        });
    });

    it('should return 404 for non-existent A/B test', () => {
      return request(app.getHttpServer())
        .post('/ml-models/ab-tests/non-existent-id/stop')
        .send({ stopReason: 'Test' })
        .expect(404);
    });
  });

  describe('/ml-models/ab-tests (GET)', () => {
    it('should get all A/B tests', () => {
      return request(app.getHttpServer())
        .get('/ml-models/ab-tests')
        .expect(200);
    });
  });

  describe('/ml-models/ab-tests/:id (GET)', () => {
    it('should get a specific A/B test', () => {
      return request(app.getHttpServer())
        .get(`/ml-models/ab-tests/${createdABTestId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(createdABTestId);
          expect(res.body.name).toBe('Test A/B Test');
        });
    });

    it('should return 404 for non-existent A/B test', () => {
      return request(app.getHttpServer())
        .get('/ml-models/ab-tests/non-existent-id')
        .expect(404);
    });
  });

  describe('/ml-models/deployments (GET)', () => {
    it('should get all deployments', () => {
      return request(app.getHttpServer())
        .get('/ml-models/deployments')
        .expect(200);
    });

    it('should filter deployments by model ID', () => {
      return request(app.getHttpServer())
        .get(`/ml-models/deployments?modelId=${createdModelId}`)
        .expect(200);
    });

    it('should filter deployments by environment', () => {
      return request(app.getHttpServer())
        .get('/ml-models/deployments?environment=production')
        .expect(200);
    });

    it('should filter deployments by status', () => {
      return request(app.getHttpServer())
        .get('/ml-models/deployments?status=active')
        .expect(200);
    });
  });

  describe('/ml-models/deployments/:id (GET)', () => {
    it('should get a specific deployment', () => {
      return request(app.getHttpServer())
        .get(`/ml-models/deployments/${createdDeploymentId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(createdDeploymentId);
          expect(res.body.modelId).toBe(createdModelId);
          expect(res.body.versionId).toBe(createdVersionId);
        });
    });

    it('should return 404 for non-existent deployment', () => {
      return request(app.getHttpServer())
        .get('/ml-models/deployments/non-existent-id')
        .expect(404);
    });
  });

  describe('/ml-models/deployments/:id/scale (POST)', () => {
    it('should scale a deployment', () => {
      const scaleDto = {
        replicas: 5,
      };

      return request(app.getHttpServer())
        .post(`/ml-models/deployments/${createdDeploymentId}/scale`)
        .send(scaleDto)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(createdDeploymentId);
        });
    });

    it('should return 404 for non-existent deployment', () => {
      const scaleDto = {
        replicas: 5,
      };

      return request(app.getHttpServer())
        .post('/ml-models/deployments/non-existent-id/scale')
        .send(scaleDto)
        .expect(404);
    });
  });

  describe('/ml-models/deployments/:id/health (GET)', () => {
    it('should check deployment health', () => {
      return request(app.getHttpServer())
        .get(`/ml-models/deployments/${createdDeploymentId}/health`)
        .expect(200);
    });

    it('should return 404 for non-existent deployment', () => {
      return request(app.getHttpServer())
        .get('/ml-models/deployments/non-existent-id/health')
        .expect(404);
    });
  });

  describe('/ml-models/deployments/:id/metrics (GET)', () => {
    it('should get deployment metrics', () => {
      return request(app.getHttpServer())
        .get(`/ml-models/deployments/${createdDeploymentId}/metrics?timeRange=24h`)
        .expect(200);
    });

    it('should return 404 for non-existent deployment', () => {
      return request(app.getHttpServer())
        .get('/ml-models/deployments/non-existent-id/metrics')
        .expect(404);
    });
  });

  describe('/ml-models/:id/monitor (POST)', () => {
    it('should monitor model performance', () => {
      return request(app.getHttpServer())
        .post(`/ml-models/${createdModelId}/monitor`)
        .expect(200);
    });

    it('should return 404 for non-existent model', () => {
      return request(app.getHttpServer())
        .post('/ml-models/non-existent-id/monitor')
        .expect(404);
    });
  });

  describe('/ml-models/:id/drift-detection (POST)', () => {
    it('should detect model drift', () => {
      const driftDetectionDto = {
        baselineData: [
          { feature1: 1.0, feature2: 2.0, target: 1 },
          { feature1: 1.5, feature2: 2.5, target: 0 },
        ],
        currentData: [
          { feature1: 1.2, feature2: 2.2, target: 1 },
          { feature1: 1.7, feature2: 2.7, target: 0 },
        ],
      };

      return request(app.getHttpServer())
        .post(`/ml-models/${createdModelId}/drift-detection`)
        .send(driftDetectionDto)
        .expect(200);
    });

    it('should return 404 for non-existent model', () => {
      const driftDetectionDto = {
        baselineData: [],
        currentData: [],
      };

      return request(app.getHttpServer())
        .post('/ml-models/non-existent-id/drift-detection')
        .send(driftDetectionDto)
        .expect(404);
    });
  });

  describe('/ml-models/:id (DELETE)', () => {
    it('should delete a model', () => {
      return request(app.getHttpServer())
        .delete(`/ml-models/${createdModelId}`)
        .expect(204);
    });

    it('should return 404 for non-existent model', () => {
      return request(app.getHttpServer())
        .delete('/ml-models/non-existent-id')
        .expect(404);
    });
  });
}); 