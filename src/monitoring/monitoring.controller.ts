import { Controller, Get, Res } from '@nestjs/common';
import { MetricsCollectionService } from './metrics/metrics-collection.service';
import { Response } from 'express';
import { ScheduledTaskMonitoringService } from './scheduled-task-monitoring.service';

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

  @Get('scheduled-tasks/dashboard')
  getScheduledTasksDashboard() {
    return this.scheduledTaskMonitoringService.getDashboard();
  }
}
