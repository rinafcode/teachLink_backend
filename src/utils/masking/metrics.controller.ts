import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { MetricsService } from './metrics.service';
import { SkipQuota } from '../rate-limiting/decorators/quota.decorator';

@ApiTags('Metrics')
@SkipQuota()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @ApiOperation({ summary: 'Get application metrics for Prometheus' })
  @ApiResponse({ status: 200, description: 'Prometheus metrics' })
  async getMetrics(@Res() res: Response): Promise<void> {
    res.set('Content-Type', this.metricsService.getRegistry().contentType);
    res.end(await this.metricsService.getMetrics());
  }
}