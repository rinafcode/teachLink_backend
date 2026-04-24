import { Controller, Get, Query, Res, VERSION_NEUTRAL, Version } from '@nestjs/common';
import { MetricsCollectionService } from './metrics/metrics-collection.service';
import { Response } from 'express';
import { ScheduledTaskMonitoringService } from './scheduled-task-monitoring.service';

@Version(VERSION_NEUTRAL)
@Controller('metrics')
export class MonitoringController {
  constructor(
    private readonly metricsService: MetricsCollectionService,
    private readonly scheduledTaskMonitoringService: ScheduledTaskMonitoringService,
  ) {}

  @Get()
  async getMetrics(@Res() res: Response) {
    const metrics = await this.metricsService.getMetrics();
    res.set('Content-Type', this.metricsService.getRegistry().contentType);
    res.send(metrics);
  }

  @Get('unified')
  async getUnifiedMetrics(
    @Query('format') format?: string,
    @Query('include') include?: string,
    @Query('exclude') exclude?: string,
  ) {
    const includeTypes = include?.split(',').map((s) => s.trim()) || [];
    const excludeTypes = exclude?.split(',').map((s) => s.trim()) || [];

    // Get base Prometheus metrics
    const prometheusMetrics = await this.metricsService.getMetrics();

    // Get scheduled tasks dashboard
    const scheduledTasksMetrics = this.scheduledTaskMonitoringService.getDashboard();

    // Aggregate metrics from different sources
    const unifiedMetrics = {
      prometheus: prometheusMetrics,
      scheduledTasks: scheduledTasksMetrics,
      timestamp: new Date().toISOString(),
      metadata: {
        totalMetrics: prometheusMetrics.split('\n').filter((line) => line && !line.startsWith('#'))
          .length,
        includeTypes,
        excludeTypes,
      },
    };

    // Return in requested format
    if (format === 'json') {
      return unifiedMetrics;
    }

    // Default to Prometheus format
    const metrics = await this.metricsService.getMetrics();
    return metrics;
  }

  @Get('health')
  async getMetricsHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        metricsCollection: 'active',
        scheduledTasks: 'active',
      },
      registry: {
        metricsCount: (await this.metricsService.getMetrics())
          .split('\n')
          .filter((line) => line && !line.startsWith('#')).length,
      },
    };
  }

  @Get('custom')
  async getCustomMetrics(@Query('type') type?: string) {
    const customMetrics = {
      user_registrations: {
        name: 'user_registrations_total',
        help: 'Total number of user registrations',
        type: 'counter',
      },
      assessment_completions: {
        name: 'assessment_completions_total',
        help: 'Total number of assessment completions',
        type: 'counter',
      },
      learning_path_progress: {
        name: 'learning_path_progress_percentage',
        help: 'Average learning path progress percentage',
        type: 'gauge',
      },
      cache_hit_rate: {
        name: 'cache_hit_rate_percentage',
        help: 'Cache hit rate percentage',
        type: 'gauge',
      },
      queue_processing_time: {
        name: 'queue_processing_duration_seconds',
        help: 'Duration of queue job processing in seconds',
        type: 'histogram',
      },
      email_campaigns_sent: {
        name: 'email_campaigns_sent_total',
        help: 'Total number of email campaigns sent',
        type: 'counter',
      },
      backup_operations: {
        name: 'backup_operations_total',
        help: 'Total number of backup operations',
        type: 'counter',
      },
    };

    if (type) {
      return customMetrics[type] || { error: 'Metric type not found' };
    }

    return customMetrics;
  }

  @Get('scheduled-tasks/dashboard')
  getScheduledTasksDashboard() {
    return this.scheduledTaskMonitoringService.getDashboard();
  }
}
