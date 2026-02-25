import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { QueueService } from './queue.service';
import { PrioritizationService, PriorityFactors } from './prioritization/prioritization.service';
import { JobSchedulerService } from './scheduler/job-scheduler.service';
import { QueueMonitoringService } from './monitoring/queue-monitoring.service';
import { JobPriority } from './enums/job-priority.enum';
import { JobOptions } from './interfaces/queue.interfaces';

/**
 * Queue Management Controller
 * Provides REST API for queue operations
 */
@Controller('queues')
export class QueueController {
  constructor(
    private readonly queueService: QueueService,
    private readonly prioritizationService: PrioritizationService,
    private readonly schedulerService: JobSchedulerService,
    private readonly monitoringService: QueueMonitoringService,
  ) {}

  /**
   * Add a new job to the queue
   */
  @Post('jobs')
  async addJob(
    @Body()
    body: {
      name: string;
      data: any;
      options?: JobOptions;
      priorityFactors?: PriorityFactors;
    },
  ) {
    let options = body.options || {};

    // Calculate priority if factors provided
    if (body.priorityFactors) {
      const priority =
        this.prioritizationService.calculatePriority(body.priorityFactors);
      options = {
        ...options,
        ...this.prioritizationService.getJobOptions(priority),
      };
    }

    const job = await this.queueService.addJob(
      body.name,
      body.data,
      options,
    );

    return {
      jobId: job.id,
      name: job.name,
      priority: job.opts.priority,
      status: 'queued',
    };
  }

  /**
   * Add multiple jobs in bulk
   */
  @Post('jobs/bulk')
  async addBulkJobs(
    @Body()
    body: {
      jobs: Array<{
        name: string;
        data: any;
        options?: JobOptions;
      }>;
    },
  ) {
    const jobs = await this.queueService.addBulkJobs(body.jobs);
    return {
      count: jobs.length,
      jobIds: jobs.map((j) => j.id),
    };
  }

  /**
   * Get job details
   */
  @Get('jobs/:id')
  async getJob(@Param('id') id: string) {
    const metrics = await this.queueService.getJobMetrics(id);
    if (!metrics) {
      return { error: 'Job not found' };
    }
    return metrics;
  }

  /**
   * Remove a job
   */
  @Delete('jobs/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeJob(@Param('id') id: string) {
    await this.queueService.removeJob(id);
  }

  /**
   * Retry a failed job
   */
  @Post('jobs/:id/retry')
  async retryJob(@Param('id') id: string) {
    await this.queueService.retryJob(id);
    return { message: 'Job retry initiated', jobId: id };
  }

  /**
   * Schedule a job
   */
  @Post('jobs/schedule')
  async scheduleJob(
    @Body()
    body: {
      name: string;
      data: any;
      scheduledTime: string;
      options?: JobOptions;
    },
  ) {
    const jobId = await this.schedulerService.scheduleJob(
      body.name,
      body.data,
      new Date(body.scheduledTime),
      body.options,
    );

    return {
      jobId,
      scheduledFor: body.scheduledTime,
      status: 'scheduled',
    };
  }

  /**
   * Schedule a delayed job
   */
  @Post('jobs/delay')
  async scheduleDelayedJob(
    @Body()
    body: {
      name: string;
      data: any;
      delayMs: number;
      options?: JobOptions;
    },
  ) {
    const jobId = await this.schedulerService.scheduleDelayedJob(
      body.name,
      body.data,
      body.delayMs,
      body.options,
    );

    return {
      jobId,
      delayMs: body.delayMs,
      status: 'scheduled',
    };
  }

  /**
   * Get all scheduled jobs
   */
  @Get('jobs/scheduled')
  async getScheduledJobs() {
    return this.schedulerService.getScheduledJobs();
  }

  /**
   * Cancel a scheduled job
   */
  @Delete('jobs/scheduled/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelScheduledJob(@Param('id') id: string) {
    await this.schedulerService.cancelScheduledJob(id);
  }

  /**
   * Get queue metrics
   */
  @Get('metrics')
  async getMetrics() {
    return this.monitoringService.getQueueMetrics();
  }

  /**
   * Get queue statistics
   */
  @Get('statistics')
  async getStatistics() {
    return this.monitoringService.getQueueStatistics();
  }

  /**
   * Get queue health status
   */
  @Get('health')
  async getHealth() {
    return this.monitoringService.checkQueueHealth();
  }

  /**
   * Get failed jobs
   */
  @Get('jobs/failed')
  async getFailedJobs(@Query('limit') limit?: number) {
    const jobs = await this.monitoringService.getFailedJobs(
      limit ? parseInt(limit.toString()) : 50,
    );
    return jobs.map((job) => ({
      id: job.id,
      name: job.name,
      data: job.data,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
    }));
  }

  /**
   * Get stuck jobs
   */
  @Get('jobs/stuck')
  async getStuckJobs(@Query('threshold') threshold?: number) {
    const jobs = await this.monitoringService.getStuckJobs(
      threshold ? parseInt(threshold.toString()) : 300000,
    );
    return jobs.map((job) => ({
      id: job.id,
      name: job.name,
      processedOn: job.processedOn,
      data: job.data,
    }));
  }

  /**
   * Get queue counts
   */
  @Get('counts')
  async getCounts() {
    return this.queueService.getQueueCounts();
  }

  /**
   * Pause the queue
   */
  @Post('pause')
  async pauseQueue() {
    await this.queueService.pauseQueue();
    return { message: 'Queue paused' };
  }

  /**
   * Resume the queue
   */
  @Post('resume')
  async resumeQueue() {
    await this.queueService.resumeQueue();
    return { message: 'Queue resumed' };
  }

  /**
   * Clean the queue
   */
  @Post('clean')
  async cleanQueue(
    @Body() body: { grace?: number; status?: 'completed' | 'failed' },
  ) {
    await this.queueService.cleanQueue(body.grace, body.status);
    return { message: 'Queue cleaned' };
  }

  /**
   * Empty the queue
   */
  @Delete('empty')
  @HttpCode(HttpStatus.NO_CONTENT)
  async emptyQueue() {
    await this.queueService.emptyQueue();
  }

  /**
   * Get active cron jobs
   */
  @Get('cron/jobs')
  async getActiveCronJobs() {
    return {
      jobs: this.schedulerService.getActiveCronJobs(),
    };
  }
}
