import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModelDeployment } from '../entities/model-deployment.entity';
import { DeploymentStatus, DeploymentEnvironment } from '../enums';
import { MLModel } from '../entities/ml-model.entity';
import { ModelVersion } from '../entities/model-version.entity';
import { DeployModelDto } from '../dto/deploy-model.dto';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class ModelDeploymentService {
  constructor(
    @InjectRepository(ModelDeployment)
    private readonly deploymentRepository: Repository<ModelDeployment>,
  ) {}

  async deployModel(
    model: MLModel,
    version: ModelVersion,
    deployment: ModelDeployment,
    deployModelDto: DeployModelDto,
  ): Promise<any> {
    try {
      // Update deployment status to deploying
      deployment.status = DeploymentStatus.DEPLOYING;
      await this.deploymentRepository.save(deployment);

      // Generate deployment configuration
      const deploymentConfig = this.generateDeploymentConfig(model, version, deployModelDto);

      // Create deployment infrastructure
      const infrastructureResult = await this.createDeploymentInfrastructure(deploymentConfig);

      // Deploy model artifacts
      const artifactResult = await this.deployModelArtifacts(version, deploymentConfig);

      // Configure model serving
      const servingResult = await this.configureModelServing(model, version, deploymentConfig);

      // Set up monitoring and health checks
      const monitoringResult = await this.setupMonitoring(deployment, deploymentConfig);

      // Generate endpoint URLs
      const endpoint = this.generateEndpoint(deployment.id, deploymentConfig.environment);
      const serviceUrl = this.generateServiceUrl(deployment.id, deploymentConfig.environment);

      return {
        endpoint,
        serviceUrl,
        deploymentConfig,
        infrastructureResult,
        artifactResult,
        servingResult,
        monitoringResult,
      };
    } catch (error) {
      // Update deployment status to failed
      deployment.status = DeploymentStatus.FAILED;
      deployment.failureReason = error.message;
      await this.deploymentRepository.save(deployment);
      throw error;
    }
  }

  async rollbackModel(
    currentDeployment: ModelDeployment,
    rollbackDeployment: ModelDeployment,
  ): Promise<void> {
    try {
      // Update current deployment status
      currentDeployment.status = DeploymentStatus.ROLLED_BACK;
      currentDeployment.rolledBackAt = new Date();
      await this.deploymentRepository.save(currentDeployment);

      // Activate rollback deployment
      rollbackDeployment.status = DeploymentStatus.ACTIVE;
      rollbackDeployment.activatedAt = new Date();
      await this.deploymentRepository.save(rollbackDeployment);

      // Perform infrastructure rollback
      await this.rollbackInfrastructure(currentDeployment, rollbackDeployment);

      // Update routing to point to rollback deployment
      await this.updateRouting(rollbackDeployment);

      // Verify rollback success
      await this.verifyRollback(rollbackDeployment);
    } catch (error) {
      throw new BadRequestException(`Rollback failed: ${error.message}`);
    }
  }

  async getDeployment(deploymentId: string): Promise<ModelDeployment> {
    const deployment = await this.deploymentRepository.findOne({
      where: { id: deploymentId },
      relations: ['model', 'version'],
    });

    if (!deployment) {
      throw new NotFoundException(`Deployment with ID ${deploymentId} not found`);
    }

    return deployment;
  }

  async getModelDeployments(
    modelId: string,
    environment?: DeploymentEnvironment,
    status?: DeploymentStatus,
  ): Promise<ModelDeployment[]> {
    const query = this.deploymentRepository.createQueryBuilder('deployment')
      .where('deployment.modelId = :modelId', { modelId })
      .orderBy('deployment.createdAt', 'DESC');

    if (environment) {
      query.andWhere('deployment.environment = :environment', { environment });
    }

    if (status) {
      query.andWhere('deployment.status = :status', { status });
    }

    return await query.getMany();
  }

  async updateDeployment(
    deploymentId: string,
    updates: Partial<ModelDeployment>,
  ): Promise<ModelDeployment> {
    const deployment = await this.getDeployment(deploymentId);
    
    Object.assign(deployment, updates);
    return await this.deploymentRepository.save(deployment);
  }

  async scaleDeployment(
    deploymentId: string,
    replicas: number,
  ): Promise<ModelDeployment> {
    const deployment = await this.getDeployment(deploymentId);
    
    if (deployment.status !== DeploymentStatus.ACTIVE) {
      throw new BadRequestException('Can only scale active deployments');
    }

    // Update scaling configuration
    const scalingConfig = deployment.scalingConfig || {};
    scalingConfig.minReplicas = replicas;
    scalingConfig.maxReplicas = replicas * 2;

    deployment.scalingConfig = scalingConfig;
    
    // Apply scaling to infrastructure
    await this.applyScaling(deployment, replicas);
    
    return await this.deploymentRepository.save(deployment);
  }

  async healthCheck(deploymentId: string): Promise<any> {
    const deployment = await this.getDeployment(deploymentId);
    
    if (!deployment.serviceUrl) {
      throw new BadRequestException('Deployment has no service URL');
    }

    try {
      // Perform health check
      const healthResult = await this.performHealthCheck(deployment);
      
      // Update deployment metrics
      deployment.performanceMetrics = {
        ...deployment.performanceMetrics,
        lastHealthCheck: new Date(),
        healthStatus: healthResult.status,
        responseTime: healthResult.responseTime,
      };
      
      await this.deploymentRepository.save(deployment);
      
      return healthResult;
    } catch (error) {
      // Update deployment with failed health check
      deployment.performanceMetrics = {
        ...deployment.performanceMetrics,
        lastHealthCheck: new Date(),
        healthStatus: 'unhealthy',
        error: error.message,
      };
      
      await this.deploymentRepository.save(deployment);
      
      throw error;
    }
  }

  async getDeploymentMetrics(deploymentId: string, timeRange: string = '24h'): Promise<any> {
    const deployment = await this.getDeployment(deploymentId);
    
    // Collect metrics from monitoring system
    const metrics = await this.collectDeploymentMetrics(deployment, timeRange);
    
    return {
      deploymentId,
      timeRange,
      metrics,
      summary: this.calculateMetricsSummary(metrics),
    };
  }

  private generateDeploymentConfig(
    model: MLModel,
    version: ModelVersion,
    deployModelDto: DeployModelDto,
  ): any {
    const baseConfig = {
      modelId: model.id,
      versionId: version.id,
      modelType: model.type,
      framework: model.framework,
      environment: deployModelDto.environment,
      replicas: deployModelDto.deploymentConfig?.replicas || 1,
      resources: deployModelDto.deploymentConfig?.resources || {
        cpu: '500m',
        memory: '1Gi',
      },
      autoscaling: deployModelDto.deploymentConfig?.autoscaling || {
        minReplicas: 1,
        maxReplicas: 5,
        targetCPUUtilization: 70,
      },
      healthCheck: deployModelDto.healthCheckConfig || {
        path: '/health',
        initialDelaySeconds: 30,
        periodSeconds: 10,
        timeoutSeconds: 5,
        failureThreshold: 3,
      },
    };

    // Add environment-specific configurations
    if (deployModelDto.environment === DeploymentEnvironment.PRODUCTION) {
      baseConfig.replicas = Math.max(baseConfig.replicas, 2);
      baseConfig.autoscaling.minReplicas = 2;
      baseConfig.autoscaling.maxReplicas = 10;
    }

    return baseConfig;
  }

  private async createDeploymentInfrastructure(config: any): Promise<any> {
    // This is a simplified implementation
    // In a real scenario, you would integrate with Kubernetes, AWS, or other cloud providers
    
    const infrastructure = {
      namespace: `ml-models-${config.environment}`,
      deployment: {
        name: `model-${config.modelId}-${config.versionId}`,
        replicas: config.replicas,
        resources: config.resources,
      },
      service: {
        name: `service-${config.modelId}-${config.versionId}`,
        port: 8080,
        targetPort: 8080,
      },
      ingress: {
        name: `ingress-${config.modelId}-${config.versionId}`,
        host: `${config.modelId}.${config.environment}.ml.example.com`,
      },
    };

    // Simulate infrastructure creation
    await this.simulateInfrastructureCreation(infrastructure);

    return infrastructure;
  }

  private async deployModelArtifacts(version: ModelVersion, config: any): Promise<any> {
    if (!version.artifactPath) {
      throw new BadRequestException('No model artifacts found for deployment');
    }

    // Load model artifacts
    const artifactPath = path.join(process.cwd(), 'artifacts', version.artifactPath);
    const modelData = await fs.readFile(artifactPath);

    // Deploy artifacts to serving infrastructure
    const artifactDeployment = {
      modelPath: `/models/${config.modelId}/${version.version}`,
      modelSize: modelData.length,
      modelHash: version.modelHash,
      deployedAt: new Date(),
    };

    // Simulate artifact deployment
    await this.simulateArtifactDeployment(artifactDeployment);

    return artifactDeployment;
  }

  private async configureModelServing(
    model: MLModel,
    version: ModelVersion,
    config: any,
  ): Promise<any> {
    const servingConfig = {
      modelType: model.type,
      framework: model.framework,
      inputSchema: model.features,
      outputSchema: model.targetVariable,
      preprocessing: this.generatePreprocessingConfig(model),
      postprocessing: this.generatePostprocessingConfig(model),
      batching: {
        enabled: true,
        maxBatchSize: 32,
        timeoutMs: 1000,
      },
    };

    // Simulate serving configuration
    await this.simulateServingConfiguration(servingConfig);

    return servingConfig;
  }

  private async setupMonitoring(deployment: ModelDeployment, config: any): Promise<any> {
    const monitoringConfig = {
      metrics: [
        'request_count',
        'request_latency',
        'error_rate',
        'model_accuracy',
        'prediction_drift',
      ],
      alerts: [
        {
          name: 'high_error_rate',
          condition: 'error_rate > 0.05',
          severity: 'critical',
        },
        {
          name: 'high_latency',
          condition: 'request_latency > 1000ms',
          severity: 'warning',
        },
        {
          name: 'model_drift',
          condition: 'prediction_drift > 0.1',
          severity: 'critical',
        },
      ],
      dashboards: [
        {
          name: 'model_performance',
          metrics: ['request_count', 'request_latency', 'error_rate'],
        },
        {
          name: 'model_quality',
          metrics: ['model_accuracy', 'prediction_drift'],
        },
      ],
    };

    // Simulate monitoring setup
    await this.simulateMonitoringSetup(monitoringConfig);

    return monitoringConfig;
  }

  private generateEndpoint(deploymentId: string, environment: string): string {
    return `https://api.${environment}.ml.example.com/v1/models/${deploymentId}`;
  }

  private generateServiceUrl(deploymentId: string, environment: string): string {
    return `https://${deploymentId}.${environment}.ml.example.com`;
  }

  private async rollbackInfrastructure(
    currentDeployment: ModelDeployment,
    rollbackDeployment: ModelDeployment,
  ): Promise<void> {
    // Simulate infrastructure rollback
    await this.simulateInfrastructureRollback(currentDeployment, rollbackDeployment);
  }

  private async updateRouting(rollbackDeployment: ModelDeployment): Promise<void> {
    // Simulate routing update
    await this.simulateRoutingUpdate(rollbackDeployment);
  }

  private async verifyRollback(rollbackDeployment: ModelDeployment): Promise<void> {
    // Simulate rollback verification
    await this.simulateRollbackVerification(rollbackDeployment);
  }

  private async applyScaling(deployment: ModelDeployment, replicas: number): Promise<void> {
    // Simulate scaling application
    await this.simulateScaling(deployment, replicas);
  }

  private async performHealthCheck(deployment: ModelDeployment): Promise<any> {
    // Simulate health check
    return await this.simulateHealthCheck(deployment);
  }

  private async collectDeploymentMetrics(deployment: ModelDeployment, timeRange: string): Promise<any> {
    // Simulate metrics collection
    return await this.simulateMetricsCollection(deployment, timeRange);
  }

  private calculateMetricsSummary(metrics: any): any {
    // Calculate summary statistics from metrics
    return {
      avgLatency: metrics.latency?.reduce((a: number, b: number) => a + b, 0) / metrics.latency?.length || 0,
      totalRequests: metrics.requestCount?.reduce((a: number, b: number) => a + b, 0) || 0,
      errorRate: metrics.errorCount?.reduce((a: number, b: number) => a + b, 0) / metrics.requestCount?.reduce((a: number, b: number) => a + b, 1) || 0,
    };
  }

  private generatePreprocessingConfig(model: MLModel): any {
    return {
      normalization: model.features?.map(feature => ({
        feature,
        method: 'standard',
      })),
      encoding: {
        categoricalFeatures: model.features?.filter(f => f.includes('cat_')),
        method: 'one_hot',
      },
    };
  }

  private generatePostprocessingConfig(model: MLModel): any {
    return {
      threshold: 0.5,
      outputFormat: 'probability',
      confidenceScoring: true,
    };
  }

  // Simulation methods for infrastructure operations
  private async simulateInfrastructureCreation(infrastructure: any): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  private async simulateArtifactDeployment(artifactDeployment: any): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  private async simulateServingConfiguration(servingConfig: any): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  private async simulateMonitoringSetup(monitoringConfig: any): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  private async simulateInfrastructureRollback(current: ModelDeployment, rollback: ModelDeployment): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  private async simulateRoutingUpdate(rollbackDeployment: ModelDeployment): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  private async simulateRollbackVerification(rollbackDeployment: ModelDeployment): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  private async simulateScaling(deployment: ModelDeployment, replicas: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  private async simulateHealthCheck(deployment: ModelDeployment): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 100));
    return {
      status: 'healthy',
      responseTime: Math.random() * 100 + 50,
      timestamp: new Date(),
    };
  }

  private async simulateMetricsCollection(deployment: ModelDeployment, timeRange: string): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 100));
    return {
      latency: Array.from({ length: 24 }, () => Math.random() * 200 + 50),
      requestCount: Array.from({ length: 24 }, () => Math.floor(Math.random() * 1000 + 100)),
      errorCount: Array.from({ length: 24 }, () => Math.floor(Math.random() * 10)),
    };
  }
} 