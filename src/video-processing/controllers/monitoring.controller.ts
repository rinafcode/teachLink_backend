import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import type { Repository } from 'typeorm';

import type { VideoProcessingJob } from '../entities/video-processing-job.entity';
import type { MonitoringService } from '../services/monitoring.service';
import type { QueueService } from '../services/queue.service';

import type { JobQueryDto, MonitoringQueryDto } from '../dto/query.dto';
import {
  SystemMetricsDto,
  JobTypeMetricsDto,
  ProcessingTrendDto,
  ErrorAnalysisDto,
  HealthCheckDto,
  QueueHealthDto,
} from '../dto/monitoring-response.dto';

@ApiTags('Monitoring')
@Controller('monitoring')
export class MonitoringController {
  constructor(
    private readonly jobRepository: Repository<VideoProcessingJob>,
    private readonly monitoringService: MonitoringService,
    private readonly queueService: QueueService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Get system health status' })
  @ApiResponse({
    status: 200,
    description: 'Health status retrieved',
    type: HealthCheckDto,
  })
  async getHealthCheck(): Promise<HealthCheckDto> {
    return await this.monitoringService.getHealthCheck();
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get system metrics' })
  @ApiResponse({
    status: 200,
    description: 'System metrics retrieved',
    type: SystemMetricsDto,
  })
  async getSystemMetrics(): Promise<SystemMetricsDto> {
    return await this.monitoringService.getSystemMetrics();
  }

  @Get('job-types')
  @ApiOperation({ summary: 'Get job type metrics' })
  @ApiResponse({
    status: 200,
    description: 'Job type metrics retrieved',
    type: [JobTypeMetricsDto],
  })
  async getJobTypeMetrics(): Promise<JobTypeMetricsDto[]> {
    return await this.monitoringService.getJobTypeMetrics();
  }

  @Get('trends')
  @ApiOperation({ summary: 'Get processing trends' })
  @ApiResponse({
    status: 200,
    description: 'Processing trends retrieved',
    type: [ProcessingTrendDto],
  })
  async getProcessingTrends(
    query: MonitoringQueryDto,
  ): Promise<ProcessingTrendDto[]> {
    return await this.monitoringService.getProcessingTrends(query.days);
  }

  @Get('errors')
  @ApiOperation({ summary: 'Get error analysis' })
  @ApiResponse({
    status: 200,
    description: 'Error analysis retrieved',
    type: [ErrorAnalysisDto],
  })
  async getErrorAnalysis(): Promise<ErrorAnalysisDto[]> {
    return await this.monitoringService.getErrorAnalysis();
  }

  @Get('queues')
  @ApiOperation({ summary: 'Get queue statistics' })
  @ApiResponse({
    status: 200,
    description: 'Queue statistics retrieved',
    type: [QueueHealthDto],
  })
  async getQueueStats() {
    return await this.queueService.getQueueStats();
  }

  @Get('jobs')
  @ApiOperation({ summary: 'Get jobs with filtering' })
  @ApiResponse({ status: 200, description: 'Jobs retrieved successfully' })
  async getJobs(query: JobQueryDto) {
    const { page, limit, status, type, videoId, createdAfter, createdBefore } =
      query;

    const queryBuilder = this.jobRepository
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.video', 'video');

    // Apply filters
    if (status) {
      queryBuilder.andWhere('job.status = :status', { status });
    }

    if (type) {
      queryBuilder.andWhere('job.type = :type', { type });
    }

    if (videoId) {
      queryBuilder.andWhere('job.videoId = :videoId', { videoId });
    }

    if (createdAfter) {
      queryBuilder.andWhere('job.createdAt >= :createdAfter', { createdAfter });
    }

    if (createdBefore) {
      queryBuilder.andWhere('job.createdAt <= :createdBefore', {
        createdBefore,
      });
    }

    // Apply sorting and pagination
    queryBuilder.orderBy('job.createdAt', 'DESC');
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    const [jobs, total] = await queryBuilder.getManyAndCount();

    return {
      data: jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get job by ID' })
  @ApiParam({ name: 'id', description: 'Job ID' })
  @ApiResponse({ status: 200, description: 'Job retrieved successfully' })
  async getJob(@Param('id', ParseUUIDPipe) id: string) {
    const job = await this.jobRepository.findOne({
      where: { id },
      relations: ['video'],
    });

    if (!job) {
      throw new Error('Job not found');
    }

    return job;
  }
}
