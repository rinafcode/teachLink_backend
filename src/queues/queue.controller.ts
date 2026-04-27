import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, IApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { THROTTLE } from '../common/constants/throttle.constants';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

import { QueueService } from './queue.service';
import { PrioritizationService } from './prioritization/prioritization.service';
import { JobSchedulerService } from './scheduler/job-scheduler.service';
import { QueueMonitoringService } from './monitoring/queue-monitoring.service';
import { IJobOptions } from './interfaces/queue.interfaces';

import {
  AddJobDto,
  AddBulkJobsDto,
  ScheduleJobDto,
  ScheduleDelayedJobDto,
  CleanQueueDto,
  FailedJobsQueryDto,
  StuckJobsQueryDto,
  AnalyticsQueryDto,
} from './dto/queue.dto';

@ApiTags('queues')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Throttle({ default: THROTTLE.QUEUE_ADMIN })
@Controller('queues')
export class QueueController {
  constructor(
    private readonly queueService: QueueService,
    private readonly prioritizationService: PrioritizationService,
    private readonly schedulerService: JobSchedulerService,
    private readonly monitoringService: QueueMonitoringService,
  ) {}

  // ── Monitoring (read-only)
  /**
   * Live queue metrics: counts per state, throughput, avg processing time.
   */
  @Get('metrics')
  @ApiOperation({ summary: 'Live queue metrics' })
  @IApiResponse({ status: 200, description: 'Current queue metrics snapshot' })
  async getMetrics() {
    return this.monitoringService.getQueueMetrics();
  }

  /**
   * Aggregated statistics with historical trends.
   */
  @Get('statistics')
  @ApiOperation({ summary: 'Queue statistics with trends' })
  async getStatistics() {
    return this.monitoringService.getQueueStatistics();
  }

  /**
   * Health status: healthy | warning | critical + issue list.
   */
  @Get('health')
  @ApiOperation({ summary: 'Queue health status' })
  async getHealth() {
    return this.monitoringService.checkQueueHealth();
  }

  /**
   * Raw job-state counts (lightweight — no processing time calculation).
   */
  @Get('counts')
  @ApiOperation({ summary: 'Job counts by state' })
  async getCounts() {
    return this.queueService.getQueueCounts();
  }

  /**
   * In-memory metrics history (sliding window).
   */
  @Get('metrics/history')
  @ApiOperation({ summary: 'Historical metrics snapshots' })
  async getMetricsHistory() {
    return { history: this.monitoringService.getMetricsHistory() };
  }

  /**
   * Retry-rate analytics: failure rates, retry counts, success-after-retry %.
   * Supports an optional windowMinutes parameter (default 60, max 1440).
   */
  @Get('metrics/retries')
  @ApiOperation({ summary: 'Retry analytics for the given time window' })
  async getRetryAnalytics(
    @Query(new ValidationPipe({ transform: true })) query: AnalyticsQueryDto,
  ) {
    return this.monitoringService.getRetryAnalytics(query.windowMinutes ?? 60);
  }

  // ── Static job-collection routes (MUST precede /:id)

  /**
   * Failed jobs — paginated, optionally filtered by job name.
   * GET /queues/jobs/failed?limit=50&offset=0&jobName=send-email
   */
  @Get('jobs/failed')
  @ApiOperation({ summary: 'List failed jobs (paginated)' })
  async getFailedJobs(@Query(new ValidationPipe({ transform: true })) query: FailedJobsQueryDto) {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const jobs = await this.monitoringService.getFailedJobs(limit, offset, query.jobName);

    return {
      data: jobs.map((job) => ({
        id: job.id,
        name: job.name,
        data: job.data,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
        maxAttempts: job.opts?.attempts ?? 3,
        stackTrace: job.stacktrace ?? [],
        timestamp: new Date(job.timestamp).toISOString(),
        processedOn: job.processedOn ? new Date(job.processedOn).toISOString() : null,
        finishedOn: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
      })),
      meta: { limit, offset, total: jobs.length },
    };
  }

  /**
   * Retry all currently-failed jobs (admin only).
   * Returns a summary of how many were requeued and how many failed to retry.
   */
  @Post('jobs/failed/retry-all')
  @Roles('admin')
  @ApiOperation({ summary: 'Retry all failed jobs (admin)' })
  @IApiResponse({ status: 200, description: 'Retry summary' })
  async retryAllFailedJobs() {
    return this.monitoringService.retryAllFailedJobs();
  }

  /**
   * Stuck jobs — active jobs that have exceeded the processing threshold.
   * GET /queues/jobs/stuck?threshold=300000
   */
  @Get('jobs/stuck')
  @ApiOperation({ summary: 'List stuck (over-threshold active) jobs' })
  async getStuckJobs(@Query(new ValidationPipe({ transform: true })) query: StuckJobsQueryDto) {
    const threshold = query.threshold ?? 300_000;
    const jobs = await this.monitoringService.getStuckJobs(threshold);

    return {
      data: jobs.map((job) => ({
        id: job.id,
        name: job.name,
        data: job.data,
        processedOn: job.processedOn ? new Date(job.processedOn).toISOString() : null,
        activeForMs: job.processedOn ? Date.now() - job.processedOn : null,
        attemptsMade: job.attemptsMade,
        priority: job.opts?.priority,
      })),
      thresholdMs: threshold,
    };
  }

  /**
   * All jobs currently in the delayed state (scheduled for future execution).
   */
  @Get('jobs/scheduled')
  @ApiOperation({ summary: 'List delayed (scheduled) jobs' })
  async getScheduledJobs() {
    return this.schedulerService.getScheduledJobs();
  }

  // ── Per-job routes (/jobs/:id — after static routes)
  /**
   * Full details + metrics for a single job.
   */
  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get job details' })
  @ApiParam({ name: 'id', description: 'Bull job ID' })
  async getJob(@Param('id') id: string) {
    const metrics = await this.queueService.getJobMetrics(id);
    if (!metrics) {
      throw new NotFoundException(`Job ${id} not found`);
    }
    return metrics;
  }

  /**
   * Retry a specific failed job.
   */
  @Post('jobs/:id/retry')
  @Roles('admin')
  @ApiOperation({ summary: 'Retry a failed job (admin)' })
  async retryJob(@Param('id') id: string) {
    const job = await this.queueService.getJob(id);
    if (!job) throw new NotFoundException(`Job ${id} not found`);

    await this.queueService.retryJob(id);
    return { message: 'Job retry initiated', jobId: id };
  }

  /**
   * Remove a specific job (any state).
   */
  @Delete('jobs/:id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a job (admin)' })
  async removeJob(@Param('id') id: string) {
    const job = await this.queueService.getJob(id);
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    await this.queueService.removeJob(id);
  }

  // ── Job submission

  /**
   * Enqueue a single job, optionally with priority factor calculation.
   */
  @Post('jobs')
  @Roles('admin')
  @ApiOperation({ summary: 'Add a job to the queue (admin)' })
  async addJob(@Body(ValidationPipe) body: AddJobDto) {
    let options: IJobOptions = body.options ?? {};

    if (body.priorityFactors) {
      const priority = this.prioritizationService.calculatePriority(body.priorityFactors as any);
      options = { ...options, ...this.prioritizationService.getJobOptions(priority) };
    }

    const job = await this.queueService.addJob(body.name, body.data, options);

    return {
      jobId: job.id,
      name: job.name,
      priority: job.opts.priority,
      status: 'queued',
    };
  }

  /**
   * Enqueue multiple jobs atomically.
   */
  @Post('jobs/bulk')
  @Roles('admin')
  @ApiOperation({ summary: 'Bulk-enqueue jobs (admin)' })
  async addBulkJobs(@Body(ValidationPipe) body: AddBulkJobsDto) {
    const jobs = await this.queueService.addBulkJobs(body.jobs);
    return {
      count: jobs.length,
      jobIds: jobs.map((j) => j.id),
    };
  }

  /**
   * Schedule a job at an absolute future timestamp.
   */
  @Post('jobs/schedule')
  @Roles('admin')
  @ApiOperation({ summary: 'Schedule a job at a specific time (admin)' })
  async scheduleJob(@Body(ValidationPipe) body: ScheduleJobDto) {
    const scheduledTime = new Date(body.scheduledTime);
    if (scheduledTime <= new Date()) {
      throw new NotFoundException('scheduledTime must be in the future');
    }

    const jobId = await this.schedulerService.scheduleJob(
      body.name,
      body.data,
      scheduledTime,
      body.options,
    );

    return { jobId, scheduledFor: body.scheduledTime, status: 'scheduled' };
  }

  /**
   * Schedule a job with a relative delay in milliseconds.
   */
  @Post('jobs/delay')
  @Roles('admin')
  @ApiOperation({ summary: 'Schedule a job with a delay (admin)' })
  async scheduleDelayedJob(@Body(ValidationPipe) body: ScheduleDelayedJobDto) {
    const jobId = await this.schedulerService.scheduleDelayedJob(
      body.name,
      body.data,
      body.delayMs,
      body.options,
    );

    return { jobId, delayMs: body.delayMs, status: 'scheduled' };
  }

  /**
   * Cancel a specific scheduled (delayed) job.
   */
  @Delete('jobs/scheduled/:id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel a scheduled job (admin)' })
  async cancelScheduledJob(@Param('id') id: string) {
    await this.schedulerService.cancelScheduledJob(id);
  }

  // ── Queue-level controls (admin only)
  @Post('pause')
  @Roles('admin')
  @ApiOperation({ summary: 'Pause the queue (admin)' })
  async pauseQueue() {
    await this.queueService.pauseQueue();
    return { message: 'Queue paused', timestamp: new Date().toISOString() };
  }

  @Post('resume')
  @Roles('admin')
  @ApiOperation({ summary: 'Resume a paused queue (admin)' })
  async resumeQueue() {
    await this.queueService.resumeQueue();
    return { message: 'Queue resumed', timestamp: new Date().toISOString() };
  }

  /**
   * Remove completed/failed jobs older than the grace period.
   */
  @Post('clean')
  @Roles('admin')
  @ApiOperation({ summary: 'Clean old jobs (admin)' })
  async cleanQueue(@Body(ValidationPipe) body: CleanQueueDto) {
    await this.queueService.cleanQueue(body.grace, body.status);
    return {
      message: 'Queue cleaned',
      grace: body.grace ?? 5000,
      status: body.status ?? 'all',
    };
  }

  /**
   * Drain the entire queue (removes ALL jobs in all states).
   * Use with extreme care — irreversible.
   */
  @Delete('empty')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Empty the queue — removes ALL jobs (admin)' })
  async emptyQueue() {
    await this.queueService.emptyQueue();
  }

  // ── Cron / scheduler info

  @Get('cron/jobs')
  @ApiOperation({ summary: 'List active cron job names' })
  async getActiveCronJobs() {
    return { jobs: this.schedulerService.getActiveCronJobs() };
  }
}
