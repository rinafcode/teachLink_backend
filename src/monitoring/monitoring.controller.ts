import { Controller, Get, Res } from '@nestjs/common';
import { MetricsCollectionService } from './metrics/metrics-collection.service';
import { Response } from 'express';

@Controller('metrics')
export class MonitoringController {
  constructor(private readonly metricsService: MetricsCollectionService) {}

  @Get()
  async getMetrics(@Res() res: Response) {
    const metrics = await this.metricsService.getMetrics();
    res.set('Content-Type', this.metricsService.getRegistry().contentType);
    res.send(metrics);
  }
}
