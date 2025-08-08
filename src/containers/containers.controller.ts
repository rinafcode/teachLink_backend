import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { AutoScalingService } from './scaling/auto-scaling.service';
import { DeploymentService } from './deployment/deployment.service';
import { ContainerMonitoringService } from './monitoring/container-monitoring.service';
import { MonitorOperation } from '../common/decorators/monitoring.decorator';

// DTOs for API documentation
export class ScaleContainerDto {
  containerId: string;
  replicas?: number;
}

export class DeployContainerDto {
  containerId: string;
  imageTag: string;
}

export class ContainerResponseDto {
  id: string;
  name: string;
  status: string;
  replicas: number;
  image: string;
  tag: string;
}

@ApiTags('Containers')
@Controller('containers')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ContainersController {
  constructor(
    private readonly autoScalingService: AutoScalingService,
    private readonly deploymentService: DeploymentService,
    private readonly monitoringService: ContainerMonitoringService,
  ) {}

  @Post('scale-up/:containerId')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Scale up a container',
    description: 'Increase the number of replicas for a container'
  })
  @ApiParam({ name: 'containerId', description: 'Container ID to scale up' })
  @ApiResponse({ 
    status: 200, 
    description: 'Container scaled up successfully',
    type: ContainerResponseDto
  })
  @ApiResponse({ status: 400, description: 'Invalid scaling request' })
  @ApiResponse({ status: 404, description: 'Container not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @MonitorOperation('scale_up_container', { 
    tags: { operation: 'scale_up', resource: 'container' },
    recordMetrics: true,
    recordTraces: true,
    recordLogs: true
  })
  async scaleUp(@Param('containerId') containerId: string) {
    await this.autoScalingService.scaleUp(containerId);
    return { 
      message: 'Container scaled up successfully',
      containerId,
      timestamp: new Date()
    };
  }

  @Post('scale-down/:containerId')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Scale down a container',
    description: 'Decrease the number of replicas for a container'
  })
  @ApiParam({ name: 'containerId', description: 'Container ID to scale down' })
  @ApiResponse({ 
    status: 200, 
    description: 'Container scaled down successfully',
    type: ContainerResponseDto
  })
  @ApiResponse({ status: 400, description: 'Invalid scaling request' })
  @ApiResponse({ status: 404, description: 'Container not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @MonitorOperation('scale_down_container', { 
    tags: { operation: 'scale_down', resource: 'container' },
    recordMetrics: true,
    recordTraces: true,
    recordLogs: true
  })
  async scaleDown(@Param('containerId') containerId: string) {
    await this.autoScalingService.scaleDown(containerId);
    return { 
      message: 'Container scaled down successfully',
      containerId,
      timestamp: new Date()
    };
  }

  @Post('deploy/:containerId')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Deploy new version of a container',
    description: 'Deploy a new image version for a container'
  })
  @ApiParam({ name: 'containerId', description: 'Container ID to deploy' })
  @ApiResponse({ 
    status: 200, 
    description: 'Container deployed successfully',
    type: ContainerResponseDto
  })
  @ApiResponse({ status: 400, description: 'Invalid deployment request' })
  @ApiResponse({ status: 404, description: 'Container not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @MonitorOperation('deploy_container', { 
    tags: { operation: 'deploy', resource: 'container' },
    recordMetrics: true,
    recordTraces: true,
    recordLogs: true
  })
  async deploy(
    @Param('containerId') containerId: string,
    @Body() deployDto: DeployContainerDto
  ) {
    await this.deploymentService.deployNewVersion(containerId, deployDto.imageTag);
    return { 
      message: 'Container deployed successfully',
      containerId,
      imageTag: deployDto.imageTag,
      timestamp: new Date()
    };
  }

  @Get('health/:containerId')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ 
    summary: 'Check container health',
    description: 'Get health status of a container'
  })
  @ApiParam({ name: 'containerId', description: 'Container ID to check' })
  @ApiResponse({ 
    status: 200, 
    description: 'Container health status',
    schema: {
      type: 'object',
      properties: {
        containerId: { type: 'string' },
        status: { type: 'string' },
        healthy: { type: 'boolean' },
        lastCheck: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Container not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @MonitorOperation('check_container_health', { 
    tags: { operation: 'health_check', resource: 'container' },
    recordMetrics: true,
    recordTraces: true
  })
  async checkHealth(@Param('containerId') containerId: string) {
    const health = await this.monitoringService.checkContainerHealth(containerId);
    return {
      containerId,
      status: health.status,
      healthy: health.healthy,
      lastCheck: new Date()
    };
  }

  @Get('metrics/:containerId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ 
    summary: 'Get container metrics',
    description: 'Get performance metrics for a container'
  })
  @ApiParam({ name: 'containerId', description: 'Container ID to get metrics for' })
  @ApiQuery({ name: 'period', required: false, description: 'Time period for metrics (1h, 24h, 7d)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Container metrics',
    schema: {
      type: 'object',
      properties: {
        containerId: { type: 'string' },
        cpu: { type: 'number' },
        memory: { type: 'number' },
        network: { type: 'object' },
        timestamp: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Container not found' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @MonitorOperation('get_container_metrics', { 
    tags: { operation: 'get_metrics', resource: 'container' },
    recordMetrics: true,
    recordTraces: true
  })
  async getMetrics(
    @Param('containerId') containerId: string,
    @Query('period') period: string = '1h'
  ) {
    const metrics = await this.monitoringService.getContainerMetrics(containerId);
    return {
      containerId,
      ...metrics,
      period,
      timestamp: new Date()
    };
  }
} 