import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ModelDeployment } from '../entities/model-deployment.entity';
import { MLModel } from '../entities/ml-model.entity';
import { ModelVersion } from '../entities/model-version.entity';
import { DeploymentStatus, DeploymentEnvironment } from '../enums';
import { DeployModelDto } from '../dto/deploy-model.dto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class ModelDeploymentService {
  private readonly logger = new Logger(ModelDeploymentService.name);
  private readonly DEPLOYMENT_BASE_PATH = './deployments';
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly MAX_ROLLBACK_ATTEMPTS = 3;

  constructor(
    @InjectRepository(ModelDeployment)
    private readonly deploymentRepository: Repository<ModelDeployment>,
    @InjectRepository(MLModel)
    private readonly modelRepository: Repository<MLModel>,
    @InjectRepository(ModelVersion)
    private readonly versionRepository: Repository<ModelVersion>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async deployModel(
    model: MLModel,
    version: ModelVersion,
    deployModelDto: DeployModelDto,
  ): Promise<ModelDeployment> {
    const deploymentId = crypto.randomUUID();
    
    try {
      this.logger.log(`Starting deployment for model ${model.id}, version ${version.id}`);
      
      // Validate deployment prerequisites
      await this.validateDeploymentPrerequisites(model, version, deployModelDto);

      // Create deployment record
      const deployment = this.deploymentRepository.create({
        id: deploymentId,
        modelId: model.id,
        versionId: version.id,
        environment: deployModelDto.environment || DeploymentEnvironment.STAGING,
        status: DeploymentStatus.DEPLOYING,
        deploymentConfig: deployModelDto.deploymentConfig || {},
        healthCheckConfig: deployModelDto.healthCheckConfig || this.getDefaultHealthCheckConfig(),
        scalingConfig: deployModelDto.scalingConfig || this.getDefaultScalingConfig(),
        monitoringConfig: deployModelDto.monitoringConfig || this.getDefaultMonitoringConfig(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const savedDeployment = await this.deploymentRepository.save(deployment);

      // Emit deployment started event
      this.eventEmitter.emit('deployment.started', {
        deploymentId,
        modelId: model.id,
        versionId: version.id,
        environment: deployment.environment,
      });

      // Perform deployment
      const deploymentResult = await this.performDeployment(deployment, model, version, deployModelDto);

      // Update deployment status
      deployment.status = DeploymentStatus.ACTIVE;
      deployment.deployedAt = new Date();
      deployment.endpoint = deploymentResult.endpoint;
      deployment.deploymentLogs = deploymentResult.logs;
      deployment.updatedAt = new Date();

      const finalDeployment = await this.deploymentRepository.save(deployment);

      // Start health monitoring
      this.startHealthMonitoring(deployment);

      // Emit deployment completed event
      this.eventEmitter.emit('deployment.completed', {
        deploymentId,
        modelId: model.id,
        versionId: version.id,
        endpoint: deploymentResult.endpoint,
      });

      // Update model status
      await this.updateModelDeploymentStatus(model.id, true);

      this.logger.log(`Deployment completed for model ${model.id}, version ${version.id}`);
      return finalDeployment;

    } catch (error) {
      // Update deployment status to failed
      await this.updateDeploymentStatus(deploymentId, DeploymentStatus.FAILED, error.message);
      
      this.logger.error(`Deployment failed for model ${model.id}: ${error.message}`, error.stack);
      throw new BadRequestException(`Deployment failed: ${error.message}`);
    }
  }

  async rollbackToVersion(
    model: MLModel,
    version: ModelVersion,
  ): Promise<ModelDeployment> {
    try {
      this.logger.log(`Starting rollback for model ${model.id} to version ${version.id}`);

      // Get current active deployment
      const currentDeployment = await this.deploymentRepository.findOne({
        where: { 
          modelId: model.id, 
          status: DeploymentStatus.ACTIVE 
        },
        order: { deployedAt: 'DESC' }
      });

      if (!currentDeployment) {
        throw new NotFoundException('No active deployment found for rollback');
      }

      // Validate rollback version
      if (currentDeployment.versionId === version.id) {
        throw new BadRequestException('Cannot rollback to the same version');
      }

      // Perform zero-downtime rollback
      const rollbackDeployment = await this.performZeroDowntimeRollback(
        currentDeployment,
        version,
        model
      );

      this.logger.log(`Rollback completed for model ${model.id} to version ${version.id}`);
      return rollbackDeployment;

    } catch (error) {
      this.logger.error(`Rollback failed for model ${model.id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async undeployModel(modelId: string, deploymentId?: string): Promise<void> {
    try {
      let deployment: ModelDeployment;

      if (deploymentId) {
        deployment = await this.deploymentRepository.findOne({
          where: { id: deploymentId, modelId }
        });
      } else {
        deployment = await this.deploymentRepository.findOne({
          where: { modelId, status: DeploymentStatus.ACTIVE },
          order: { deployedAt: 'DESC' }
        });
      }

      if (!deployment) {
        throw new NotFoundException('No deployment found to undeploy');
      }

      // Perform undeployment
      await this.performUndeployment(deployment);

      // Update deployment status
      deployment.status = DeploymentStatus.UNDEPLOYED;
      deployment.undeployedAt = new Date();
      deployment.updatedAt = new Date();
      await this.deploymentRepository.save(deployment);

      // Update model status
      await this.updateModelDeploymentStatus(modelId, false);

      // Emit undeployment event
      this.eventEmitter.emit('deployment.undeployed', {
        deploymentId: deployment.id,
        modelId,
        versionId: deployment.versionId,
      });

      this.logger.log(`Undeployment completed for model ${modelId}`);

    } catch (error) {
      this.logger.error(`Undeployment failed for model ${modelId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getDeploymentStatus(deploymentId: string): Promise<any> {
    try {
      const deployment = await this.deploymentRepository.findOne({
        where: { id: deploymentId },
        relations: ['model', 'version']
      });

      if (!deployment) {
        throw new NotFoundException(`Deployment ${deploymentId} not found`);
      }

      const healthStatus = await this.checkDeploymentHealth(deployment);
      const metrics = await this.getDeploymentMetrics(deployment);

      return {
        deployment,
        health: healthStatus,
        metrics,
        uptime: this.calculateUptime(deployment),
      };
    } catch (error) {
      this.logger.error(`Failed to get deployment status ${deploymentId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async scaleDeployment(deploymentId: string, scalingConfig: any): Promise<ModelDeployment> {
    try {
      const deployment = await this.deploymentRepository.findOne({
        where: { id: deploymentId }
      });

      if (!deployment) {
        throw new NotFoundException(`Deployment ${deploymentId} not found`);
      }

      if (deployment.status !== DeploymentStatus.ACTIVE) {
        throw new BadRequestException('Can only scale active deployments');
      }

      // Perform scaling
      await this.performScaling(deployment, scalingConfig);

      // Update deployment configuration
      deployment.scalingConfig = { ...deployment.scalingConfig, ...scalingConfig };
      deployment.updatedAt = new Date();
      
      const updatedDeployment = await this.deploymentRepository.save(deployment);

      this.eventEmitter.emit('deployment.scaled', {
        deploymentId,
        scalingConfig,
      });

      return updatedDeployment;
    } catch (error) {
      this.logger.error(`Failed to scale deployment ${deploymentId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getDeploymentHistory(modelId: string, limit: number = 10): Promise<ModelDeployment[]> {
    try {
      return await this.deploymentRepository.find({
        where: { modelId },
        order: { deployedAt: 'DESC' },
        take: limit,
        relations: ['version'],
      });
    } catch (error) {
      this.logger.error(`Failed to get deployment history for model ${modelId}: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Private helper methods
  private async validateDeploymentPrerequisites(
    model: MLModel,
    version: ModelVersion,
    deployModelDto: DeployModelDto,
  ): Promise<void> {
    // Check if model is trained
    if (model.status !== 'TRAINED') {
      throw new BadRequestException('Model must be trained before deployment');
    }

    // Check if version is ready
    if (version.status !== 'READY') {
      throw new BadRequestException('Version must be ready before deployment');
    }

    // Check for conflicting deployments
    const activeDeployment = await this.deploymentRepository.findOne({
      where: { 
        modelId: model.id, 
        environment: deployModelDto.environment,
        status: DeploymentStatus.ACTIVE 
      }
    });

    if (activeDeployment && !deployModelDto.force) {
      throw new BadRequestException(
        `Active deployment exists in ${deployModelDto.environment} environment. Use force=true to override.`
      );
    }

    // Validate deployment configuration
    this.validateDeploymentConfig(deployModelDto.deploymentConfig);
  }

  private validateDeploymentConfig(config: any): void {
    if (config?.resources) {
      if (config.resources.memory && config.resources.memory < 512) {
        throw new BadRequestException('Minimum memory requirement is 512MB');
      }
      if (config.resources.cpu && config.resources.cpu < 0.5) {
        throw new BadRequestException('Minimum CPU requirement is 0.5 cores');
      }
    }
  }

  private async performDeployment(
    deployment: ModelDeployment,
    model: MLModel,
    version: ModelVersion,
    deployModelDto: DeployModelDto,
  ): Promise<any> {
    // Simulate deployment process
    const deploymentSteps = [
      'Preparing deployment environment',
      'Copying model artifacts',
      'Starting model service',
      'Configuring load balancer',
      'Running health checks',
      'Activating deployment'
    ];

    const logs = [];
    const startTime = Date.now();

    for (const step of deploymentSteps) {
      logs.push(`[${new Date().toISOString()}] ${step}`);
      await this.simulateDeploymentStep(step);
    }

    const endpoint = this.generateEndpoint(deployment.id, deployModelDto.environment);
    
    return {
      endpoint,
      logs,
      deploymentTime: Date.now() - startTime,
    };
  }

  private async performZeroDowntimeRollback(
    currentDeployment: ModelDeployment,
    targetVersion: ModelVersion,
    model: MLModel,
  ): Promise<ModelDeployment> {
    const rollbackId = crypto.randomUUID();
    
    try {
      // Create new deployment with target version
      const rollbackDeployment = this.deploymentRepository.create({
        id: rollbackId,
        modelId: model.id,
        versionId: targetVersion.id,
        environment: currentDeployment.environment,
        status: DeploymentStatus.DEPLOYING,
        deploymentConfig: currentDeployment.deploymentConfig,
        healthCheckConfig: currentDeployment.healthCheckConfig,
        scalingConfig: currentDeployment.scalingConfig,
        monitoringConfig: currentDeployment.monitoringConfig,
        isRollback: true,
        rollbackFromDeploymentId: currentDeployment.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const savedRollbackDeployment = await this.deploymentRepository.save(rollbackDeployment);

      // Perform blue-green deployment
      await this.performBlueGreenDeployment(currentDeployment, savedRollbackDeployment, model, targetVersion);

      // Update deployment status
      savedRollbackDeployment.status = DeploymentStatus.ACTIVE;
      savedRollbackDeployment.deployedAt = new Date();
      savedRollbackDeployment.endpoint = currentDeployment.endpoint; // Keep same endpoint
      savedRollbackDeployment.updatedAt = new Date();

      const finalRollbackDeployment = await this.deploymentRepository.save(savedRollbackDeployment);

      // Mark old deployment as inactive
      currentDeployment.status = DeploymentStatus.INACTIVE;
      currentDeployment.updatedAt = new Date();
      await this.deploymentRepository.save(currentDeployment);

      // Start health monitoring for new deployment
      this.startHealthMonitoring(finalRollbackDeployment);

      this.eventEmitter.emit('deployment.rollback.completed', {
        rollbackDeploymentId: rollbackId,
        originalDeploymentId: currentDeployment.id,
        modelId: model.id,
        targetVersionId: targetVersion.id,
      });

      return finalRollbackDeployment;

    } catch (error) {
      // Rollback failed - attempt to restore original deployment
      await this.attemptRollbackRecovery(currentDeployment, error.message);
      throw error;
    }
  }

  private async performBlueGreenDeployment(
    blueDeployment: ModelDeployment,
    greenDeployment: ModelDeployment,
    model: MLModel,
    targetVersion: ModelVersion,
  ): Promise<void> {
    // Simulate blue-green deployment process
    const steps = [
      'Deploying green environment',
      'Running health checks on green environment',
      'Switching traffic to green environment',
      'Verifying green environment stability',
      'Decommissioning blue environment'
    ];

    for (const step of steps) {
      await this.simulateDeploymentStep(step);
      
      // Simulate health check
      const isHealthy = await this.simulateHealthCheck(greenDeployment);
      if (!isHealthy && step.includes('health checks')) {
        throw new Error('Health check failed during blue-green deployment');
      }
    }
  }

  private async attemptRollbackRecovery(
    originalDeployment: ModelDeployment,
    errorMessage: string,
  ): Promise<void> {
    this.logger.warn(`Attempting rollback recovery for deployment ${originalDeployment.id}`);
    
    try {
      // Attempt to restore original deployment
      originalDeployment.status = DeploymentStatus.ACTIVE;
      originalDeployment.updatedAt = new Date();
      await this.deploymentRepository.save(originalDeployment);
      
      this.logger.log(`Rollback recovery successful for deployment ${originalDeployment.id}`);
    } catch (recoveryError) {
      this.logger.error(`Rollback recovery failed: ${recoveryError.message}`, recoveryError.stack);
    }
  }

  private async performUndeployment(deployment: ModelDeployment): Promise<void> {
    const steps = [
      'Stopping model service',
      'Removing from load balancer',
      'Cleaning up resources',
      'Updating DNS records'
    ];

    for (const step of steps) {
      await this.simulateDeploymentStep(step);
    }
  }

  private async performScaling(deployment: ModelDeployment, scalingConfig: any): Promise<void> {
    const steps = [
      'Analyzing current load',
      'Calculating required resources',
      'Scaling up/down instances',
      'Updating load balancer configuration',
      'Verifying scaling operation'
    ];

    for (const step of steps) {
      await this.simulateDeploymentStep(step);
    }
  }

  private async simulateDeploymentStep(step: string): Promise<void> {
    // Simulate deployment step with random delay
    const delay = Math.random() * 2000 + 500; // 500-2500ms
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private async simulateHealthCheck(deployment: ModelDeployment): Promise<boolean> {
    // Simulate health check with 95% success rate
    return Math.random() > 0.05;
  }

  private generateEndpoint(deploymentId: string, environment: DeploymentEnvironment): string {
    const baseUrl = environment === DeploymentEnvironment.PRODUCTION 
      ? 'https://api.production.com' 
      : 'https://api.staging.com';
    
    return `${baseUrl}/models/${deploymentId}`;
  }

  private getDefaultHealthCheckConfig(): any {
    return {
      endpoint: '/health',
      interval: 30,
      timeout: 10,
      retries: 3,
      successThreshold: 1,
      failureThreshold: 3,
    };
  }

  private getDefaultScalingConfig(): any {
    return {
      minReplicas: 1,
      maxReplicas: 10,
      targetCPUUtilization: 70,
      targetMemoryUtilization: 80,
      scaleUpCooldown: 300,
      scaleDownCooldown: 300,
    };
  }

  private getDefaultMonitoringConfig(): any {
    return {
      enableMetrics: true,
      enableLogging: true,
      enableTracing: true,
      alertThresholds: {
        cpu: 80,
        memory: 85,
        errorRate: 5,
        latency: 1000,
      },
    };
  }

  private async updateDeploymentStatus(
    deploymentId: string,
    status: DeploymentStatus,
    errorMessage?: string,
  ): Promise<void> {
    try {
      await this.deploymentRepository.update(deploymentId, {
        status,
        errorMessage,
        updatedAt: new Date(),
      });
    } catch (error) {
      this.logger.error(`Failed to update deployment status: ${error.message}`, error.stack);
    }
  }

  private async updateModelDeploymentStatus(modelId: string, isDeployed: boolean): Promise<void> {
    try {
      await this.modelRepository.update(modelId, {
        lastDeployedAt: isDeployed ? new Date() : null,
        updatedAt: new Date(),
      });
    } catch (error) {
      this.logger.error(`Failed to update model deployment status: ${error.message}`, error.stack);
    }
  }

  private startHealthMonitoring(deployment: ModelDeployment): void {
    // Start periodic health monitoring
    setInterval(async () => {
      try {
        const isHealthy = await this.checkDeploymentHealth(deployment);
        
        if (!isHealthy) {
          this.logger.warn(`Health check failed for deployment ${deployment.id}`);
          this.eventEmitter.emit('deployment.unhealthy', {
            deploymentId: deployment.id,
            modelId: deployment.modelId,
          });
        }
      } catch (error) {
        this.logger.error(`Health monitoring error for deployment ${deployment.id}: ${error.message}`);
      }
    }, this.HEALTH_CHECK_INTERVAL);
  }

  private async checkDeploymentHealth(deployment: ModelDeployment): Promise<any> {
    // Simulate health check
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date(),
      responseTime: Math.random() * 100 + 50, // 50-150ms
      cpuUsage: Math.random() * 30 + 20, // 20-50%
      memoryUsage: Math.random() * 40 + 30, // 30-70%
      activeConnections: Math.floor(Math.random() * 100),
    };

    return healthStatus;
  }

  private async getDeploymentMetrics(deployment: ModelDeployment): Promise<any> {
    // Simulate metrics collection
    return {
      requestsPerSecond: Math.random() * 100 + 10,
      averageResponseTime: Math.random() * 200 + 50,
      errorRate: Math.random() * 2,
      cpuUsage: Math.random() * 30 + 20,
      memoryUsage: Math.random() * 40 + 30,
      activeConnections: Math.floor(Math.random() * 100),
    };
  }

  private calculateUptime(deployment: ModelDeployment): number {
    if (!deployment.deployedAt) return 0;
    
    const now = new Date();
    const deployedAt = new Date(deployment.deployedAt);
    const uptimeMs = now.getTime() - deployedAt.getTime();
    
    return Math.floor(uptimeMs / 1000); // Return uptime in seconds
  }
} 