import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PerformanceAnalysisService } from './performance/performance-analysis.service';
import { OptimizationService } from './optimization/optimization.service';
import { AlertingService } from './alerting/alerting.service';

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(
    private readonly analysisService: PerformanceAnalysisService,
    private readonly optimizationService: OptimizationService,
    private readonly alertingService: AlertingService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    this.logger.debug('Running system performance analysis...');
    const analysis = await this.analysisService.analyze();

    // Evaluate metrics against defined alert thresholds
    this.alertingService.evaluateMetricThreshold('cpu_load', analysis.cpuLoad);
    this.alertingService.evaluateMetricThreshold('memory_usage', analysis.memoryUsage);

    // Get optimization recommendations
    const recommendations = this.optimizationService.getOptimizationRecommendations(analysis);
    if (recommendations.length > 0) {
      this.logger.log(`Optimization Recommendations: ${JSON.stringify(recommendations)}`);
    }
  }
}
