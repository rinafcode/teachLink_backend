import { IsString, IsOptional, IsObject, IsEnum } from 'class-validator';
import { DeploymentEnvironment } from '../enums';

export class DeployModelDto {
  @IsString()
  modelId: string;

  @IsString()
  versionId: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(DeploymentEnvironment)
  environment: DeploymentEnvironment;

  @IsOptional()
  @IsObject()
  deploymentConfig?: {
    replicas?: number;
    resources?: {
      cpu?: string;
      memory?: string;
    };
    autoscaling?: {
      minReplicas?: number;
      maxReplicas?: number;
      targetCPUUtilization?: number;
    };
  };

  @IsOptional()
  @IsObject()
  scalingConfig?: {
    minReplicas?: number;
    maxReplicas?: number;
    targetCPUUtilization?: number;
    targetMemoryUtilization?: number;
  };

  @IsOptional()
  @IsObject()
  healthCheckConfig?: {
    path?: string;
    initialDelaySeconds?: number;
    periodSeconds?: number;
    timeoutSeconds?: number;
    failureThreshold?: number;
  };

  @IsOptional()
  @IsString()
  deployedBy?: string;
} 