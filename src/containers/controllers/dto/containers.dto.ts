import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsUUID,
  IsNotEmpty,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class ScaleContainerDto {
  @ApiProperty({
    description: 'Reason for scaling operation',
    example: 'High traffic load',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({
    description: 'Additional metadata for the scaling operation',
    example: { triggeredBy: 'auto-scaling', loadThreshold: 80 },
    required: false,
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class DeployContainerDto {
  @ApiProperty({
    description: 'New image tag for deployment',
    example: 'v1.2.3',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  imageTag: string;

  @ApiProperty({
    description: 'Deployment strategy',
    example: 'rolling',
    required: false,
  })
  @IsOptional()
  @IsString()
  strategy?: string;

  @ApiProperty({
    description: 'Additional deployment configuration',
    example: { replicas: 3, resources: { cpu: '500m', memory: '1Gi' } },
    required: false,
  })
  @IsOptional()
  config?: Record<string, any>;
}

export class ContainerResponseDto {
  @ApiProperty({
    description: 'Container ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  id: string;

  @ApiProperty({
    description: 'Operation performed',
    example: 'scale-up',
  })
  @IsString()
  operation: string;

  @ApiProperty({
    description: 'Operation status',
    example: 'success',
  })
  @IsString()
  status: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Container scaled up successfully',
  })
  @IsString()
  message: string;

  @ApiProperty({
    description: 'Operation timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  timestamp: Date;

  @ApiProperty({
    description: 'Additional metadata',
    required: false,
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class ScalingHistoryDto {
  @ApiProperty({
    description: 'Job ID',
    example: 'job-123',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'Scaling operation type',
    example: 'scale-up',
  })
  @IsString()
  type: string;

  @ApiProperty({
    description: 'Job status',
    example: 'completed',
  })
  @IsString()
  status: string;

  @ApiProperty({
    description: 'Operation timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  timestamp: Date;

  @ApiProperty({
    description: 'Previous number of replicas',
    example: 2,
  })
  @IsNumber()
  previousReplicas: number;

  @ApiProperty({
    description: 'New number of replicas',
    example: 3,
  })
  @IsNumber()
  newReplicas: number;

  @ApiProperty({
    description: 'Operation duration in milliseconds',
    example: 1500,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  duration?: number;
}

export class ContainerHealthDto {
  @ApiProperty({
    description: 'Container ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  id: string;

  @ApiProperty({
    description: 'Health status',
    example: 'healthy',
  })
  @IsString()
  status: string;

  @ApiProperty({
    description: 'Health check timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  timestamp: Date;

  @ApiProperty({
    description: 'Health check details',
    example: { uptime: 3600, lastCheck: '2024-01-01T00:00:00.000Z' },
  })
  details: Record<string, any>;
}

export class ContainerMetricsDto {
  @ApiProperty({
    description: 'Container ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  id: string;

  @ApiProperty({
    description: 'CPU usage percentage',
    example: 45.2,
  })
  @IsNumber()
  cpuUsage: number;

  @ApiProperty({
    description: 'Memory usage percentage',
    example: 67.8,
  })
  @IsNumber()
  memoryUsage: number;

  @ApiProperty({
    description: 'Network I/O in bytes',
    example: { bytesIn: 1024000, bytesOut: 512000 },
  })
  networkIO: {
    bytesIn: number;
    bytesOut: number;
  };

  @ApiProperty({
    description: 'Disk I/O in bytes',
    example: { bytesRead: 2048000, bytesWritten: 1024000 },
  })
  diskIO: {
    bytesRead: number;
    bytesWritten: number;
  };

  @ApiProperty({
    description: 'Metrics timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  timestamp: Date;
}

export class ContainerListQueryDto {
  @ApiProperty({
    description: 'Filter by container status',
    example: 'running',
    required: false,
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({
    description: 'Filter by cluster ID',
    example: 'cluster-123',
    required: false,
  })
  @IsOptional()
  @IsString()
  clusterId?: string;

  @ApiProperty({
    description: 'Page number',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiProperty({
    description: 'Items per page',
    example: 10,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}
