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
    
    // Check for alerts
    if (analysis.cpuLoad > 80) {
        this.alertingService.sendAlert('CPU_HIGH', `CPU Load is at ${analysis.cpuLoad.toFixed(2)}%`, 'WARNING');
    }
    if (analysis.memoryUsage > 90) {
        this.alertingService.sendAlert('MEMORY_HIGH', `Memory Usage is at ${analysis.memoryUsage.toFixed(2)}%`, 'WARNING');
    }

    // Get optimization recommendations
    const recommendations = this.optimizationService.getOptimizationRecommendations(analysis);
    if (recommendations.length > 0) {
        this.logger.log(`Optimization Recommendations: ${JSON.stringify(recommendations)}`);
    }
  }
}
