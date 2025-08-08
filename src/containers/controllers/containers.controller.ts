import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { AutoScalingService } from '../scaling/auto-scaling.service';
import { DeploymentService } from '../deployment/deployment.service';
import { ContainerMonitoringService } from '../monitoring/container-monitoring.service';
import { LoadBalancingService } from '../balancing/load-balancing.service';
import { OrchestrationService } from '../orchestration/orchestration.service';
import { 
  ScaleContainerDto, 
  DeployContainerDto, 
  ContainerResponseDto,
  ScalingHistoryDto 
} from './dto/containers.dto';
import { 
  ContainerNotFoundException,
  InvalidScalingRequestException,
  InsufficientPermissionsException 
} from '../../common/exceptions/custom-exceptions';

@ApiTags('Containers')
@Controller('containers')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ContainersController {
  constructor(
    private readonly autoScalingService: AutoScalingService,
    private readonly deploymentService: DeploymentService,
    private readonly monitoringService: ContainerMonitoringService,
    private readonly loadBalancingService: LoadBalancingService,
    private readonly orchestrationService: OrchestrationService,
  ) {}

  @Post(':id/scale-up')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ 
    summary: 'Scale up a container',
    description: 'Increase the number of replicas for a container'
  })
  @ApiParam({ name: 'id', description: 'Container ID', type: 'string' })
  @ApiBody({ type: ScaleContainerDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Container scaled up successfully',
    type: ContainerResponseDto 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid scaling request' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Container not found' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Insufficient permissions' 
  })
  async scaleUp(
    @Param('id', ParseUUIDPipe) containerId: string,
    @Body(ValidationPipe) scaleDto: ScaleContainerDto,
  ): Promise<ContainerResponseDto> {
    try {
      await this.autoScalingService.scaleUp(containerId);
      
      return {
        id: containerId,
        operation: 'scale-up',
        status: 'success',
        message: 'Container scaled up successfully',
        timestamp: new Date(),
      };
    } catch (error) {
      if (error instanceof ContainerNotFoundException) {
        throw error;
      }
      if (error instanceof InvalidScalingRequestException) {
        throw error;
      }
      throw error;
    }
  }

  @Post(':id/scale-down')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ 
    summary: 'Scale down a container',
    description: 'Decrease the number of replicas for a container'
  })
  @ApiParam({ name: 'id', description: 'Container ID', type: 'string' })
  @ApiBody({ type: ScaleContainerDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Container scaled down successfully',
    type: ContainerResponseDto 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid scaling request' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Container not found' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Insufficient permissions' 
  })
  async scaleDown(
    @Param('id', ParseUUIDPipe) containerId: string,
    @Body(ValidationPipe) scaleDto: ScaleContainerDto,
  ): Promise<ContainerResponseDto> {
    try {
      await this.autoScalingService.scaleDown(containerId);
      
      return {
        id: containerId,
        operation: 'scale-down',
        status: 'success',
        message: 'Container scaled down successfully',
        timestamp: new Date(),
      };
    } catch (error) {
      if (error instanceof ContainerNotFoundException) {
        throw error;
      }
      if (error instanceof InvalidScalingRequestException) {
        throw error;
      }
      throw error;
    }
  }

  @Get(':id/scaling-history')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ 
    summary: 'Get scaling history for a container',
    description: 'Retrieve the scaling operation history for a specific container'
  })
  @ApiParam({ name: 'id', description: 'Container ID', type: 'string' })
  @ApiQuery({ name: 'limit', required: false, type: 'number', description: 'Number of records to return' })
  @ApiResponse({ 
    status: 200, 
    description: 'Scaling history retrieved successfully',
    type: [ScalingHistoryDto] 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Container not found' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Insufficient permissions' 
  })
  async getScalingHistory(
    @Param('id', ParseUUIDPipe) containerId: string,
    @Query('limit') limit?: number,
  ): Promise<ScalingHistoryDto[]> {
    try {
      const history = await this.autoScalingService.getScalingHistory(containerId);
      
      if (limit) {
        return history.slice(0, limit);
      }
      
      return history;
    } catch (error) {
      if (error instanceof ContainerNotFoundException) {
        throw error;
      }
      throw error;
    }
  }

  @Post(':id/deploy')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ 
    summary: 'Deploy a new version of a container',
    description: 'Deploy a new version with the specified image tag'
  })
  @ApiParam({ name: 'id', description: 'Container ID', type: 'string' })
  @ApiBody({ type: DeployContainerDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Container deployed successfully',
    type: ContainerResponseDto 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid deployment request' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Container not found' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Insufficient permissions - Admin only' 
  })
  async deployNewVersion(
    @Param('id', ParseUUIDPipe) containerId: string,
    @Body(ValidationPipe) deployDto: DeployContainerDto,
  ): Promise<ContainerResponseDto> {
    try {
      await this.deploymentService.deployNewVersion(containerId, deployDto.imageTag);
      
      return {
        id: containerId,
        operation: 'deploy',
        status: 'success',
        message: 'Container deployed successfully',
        timestamp: new Date(),
        metadata: {
          newImageTag: deployDto.imageTag,
        },
      };
    } catch (error) {
      if (error instanceof ContainerNotFoundException) {
        throw error;
      }
      throw error;
    }
  }

  @Get(':id/health')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ 
    summary: 'Get container health status',
    description: 'Retrieve the current health status of a container'
  })
  @ApiParam({ name: 'id', description: 'Container ID', type: 'string' })
  @ApiResponse({ 
    status: 200, 
    description: 'Container health status retrieved successfully' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Container not found' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Insufficient permissions' 
  })
  async getContainerHealth(@Param('id', ParseUUIDPipe) containerId: string) {
    try {
      return await this.monitoringService.checkContainerHealth(containerId);
    } catch (error) {
      if (error instanceof ContainerNotFoundException) {
        throw error;
      }
      throw error;
    }
  }

  @Get(':id/metrics')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  @ApiOperation({ 
    summary: 'Get container metrics',
    description: 'Retrieve performance metrics for a container'
  })
  @ApiParam({ name: 'id', description: 'Container ID', type: 'string' })
  @ApiQuery({ name: 'period', required: false, type: 'string', description: 'Time period for metrics (1h, 24h, 7d)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Container metrics retrieved successfully' 
  })
  @ApiResponse({ 
    status: 404, 
    description: 'Container not found' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Insufficient permissions' 
  })
  async getContainerMetrics(
    @Param('id', ParseUUIDPipe) containerId: string,
    @Query('period') period?: string,
  ) {
    try {
      return await this.monitoringService.getContainerMetrics(containerId);
    } catch (error) {
      if (error instanceof ContainerNotFoundException) {
        throw error;
      }
      throw error;
    }
  }
} 