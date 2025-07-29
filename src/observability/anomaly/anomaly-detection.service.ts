import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan } from 'typeorm';
import { AnomalyAlert, AnomalySeverity, AnomalyStatus, AnomalyType } from '../entities/anomaly-alert.entity';
import { MetricEntry } from '../entities/metric-entry.entity';
import { LogEntry, LogLevel } from '../entities/log-entry.entity';
import { ObservabilityConfig } from '../observability.service';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

interface AnomalyRule {
  id: string;
  name: string;
  type: AnomalyType;
  metricName?: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'ne';
  timeWindow: number; // in minutes
  severity: AnomalySeverity;
  description: string;
  enabled: boolean;
}

interface AnomalyDetectionAlgorithm {
  detectStatisticalAnomalies(values: number[], threshold: number): boolean;
  detectTrendAnomalies(values: number[], windowSize: number): boolean;
  detectSeasonalAnomalies(values: number[], period: number): boolean;
}

@Injectable()
export class AnomalyDetectionService implements AnomalyDetectionAlgorithm {
  private readonly logger = new Logger(AnomalyDetectionService.name);
  private config: ObservabilityConfig;
  private anomalyRules: AnomalyRule[] = [];

  constructor(
    @InjectRepository(AnomalyAlert)
    private readonly anomalyAlertRepository: Repository<AnomalyAlert>,
    @InjectRepository(MetricEntry)
    private readonly metricEntryRepository: Repository<MetricEntry>,
    @InjectRepository(LogEntry)
    private readonly logEntryRepository: Repository<LogEntry>,
    private readonly configService: ConfigService,
    @InjectQueue('anomaly-detection') private readonly anomalyQueue: Queue,
  ) {
    this.initializeDefaultRules();
  }

  async initialize(config: ObservabilityConfig): Promise<void> {
    this.config = config;
    this.logger.log('Anomaly detection service initialized');
  }

  private initializeDefaultRules(): void {
    this.anomalyRules = [
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        type: AnomalyType.ERROR_RATE,
        metricName: 'errors',
        threshold: 10,
        operator: 'gt',
        timeWindow: 5,
        severity: AnomalySeverity.HIGH,
        description: 'Error rate exceeded normal threshold',
        enabled: true,
      },
      {
        id: 'slow-response-time',
        name: 'Slow Response Time',
        type: AnomalyType.PERFORMANCE,
        metricName: 'request_duration',
        threshold: 5000, // 5 seconds
        operator: 'gt',
        timeWindow: 10,
        severity: AnomalySeverity.MEDIUM,
        description: 'Response time is significantly higher than normal',
        enabled: true,
      },
      {
        id: 'high-memory-usage',
        name: 'High Memory Usage',
        type: AnomalyType.RESOURCE_USAGE,
        metricName: 'memory_heap_used',
        threshold: 0.9, // 90% of heap
        operator: 'gt',
        timeWindow: 15,
        severity: AnomalySeverity.HIGH,
        description: 'Memory usage is critically high',
        enabled: true,
      },
      {
        id: 'low-active-users',
        name: 'Unusually Low Active Users',
        type: AnomalyType.BUSINESS_METRIC,
        metricName: 'active_users',
        threshold: 100,
        operator: 'lt',
        timeWindow: 30,
        severity: AnomalySeverity.MEDIUM,
        description: 'Active user count is significantly below normal',
        enabled: true,
      },
      {
        id: 'failed-payments-spike',
        name: 'Failed Payments Spike',
        type: AnomalyType.BUSINESS_METRIC,
        metricName: 'payment_transactions',
        threshold: 5,
        operator: 'gt',
        timeWindow: 10,
        severity: AnomalySeverity.HIGH,
        description: 'Unusual spike in failed payment transactions',
        enabled: true,
      },
    ];
  }

  /**
   * Main anomaly detection job that runs periodically
   */
  @Cron('0 */5 * * * *') // Every 5 minutes
  async runAnomalyDetection(): Promise<void> {
    this.logger.debug('Running anomaly detection');

    for (const rule of this.anomalyRules.filter(r => r.enabled)) {
      try {
        await this.checkRule(rule);
      } catch (error) {
        this.logger.error(`Error checking anomaly rule ${rule.id}:`, error);
      }
    }

    // Also check for pattern anomalies
    await this.detectLogPatternAnomalies();
    await this.detectUserBehaviorAnomalies();
  }

  /**
   * Check a specific anomaly rule
   */
  private async checkRule(rule: AnomalyRule): Promise<void> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - rule.timeWindow * 60 * 1000);

    if (rule.metricName) {
      const metrics = await this.metricEntryRepository.find({
        where: {
          metricName: rule.metricName,
          timestamp: Between(startTime, endTime),
        },
        order: { timestamp: 'ASC' },
      });

      if (metrics.length === 0) return;

      const values = metrics.map(m => Number(m.value));
      const isAnomaly = this.evaluateRule(rule, values);

      if (isAnomaly) {
        await this.createAnomalyAlert(rule, values[values.length - 1], metrics[0].correlationId);
      }
    }
  }

  /**
   * Evaluate if values violate the anomaly rule
   */
  private evaluateRule(rule: AnomalyRule, values: number[]): boolean {
    const latestValue = values[values.length - 1];

    // Basic threshold check
    let thresholdViolated = false;
    switch (rule.operator) {
      case 'gt':
        thresholdViolated = latestValue > rule.threshold;
        break;
      case 'lt':
        thresholdViolated = latestValue < rule.threshold;
        break;
      case 'eq':
        thresholdViolated = latestValue === rule.threshold;
        break;
      case 'ne':
        thresholdViolated = latestValue !== rule.threshold;
        break;
    }

    if (!thresholdViolated) return false;

    // Advanced anomaly detection
    const statisticalAnomaly = this.detectStatisticalAnomalies(values, 2.0);
    const trendAnomaly = this.detectTrendAnomalies(values, 5);

    return statisticalAnomaly || trendAnomaly;
  }

  /**
   * Detect statistical anomalies using z-score
   */
  detectStatisticalAnomalies(values: number[], threshold: number = 2.0): boolean {
    if (values.length < 10) return false;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return false;

    const latestValue = values[values.length - 1];
    const zScore = Math.abs((latestValue - mean) / stdDev);

    return zScore > threshold;
  }

  /**
   * Detect trend anomalies
   */
  detectTrendAnomalies(values: number[], windowSize: number = 5): boolean {
    if (values.length < windowSize * 2) return false;

    const recentValues = values.slice(-windowSize);
    const previousValues = values.slice(-windowSize * 2, -windowSize);

    const recentAvg = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    const previousAvg = previousValues.reduce((sum, val) => sum + val, 0) / previousValues.length;

    // Check for significant change (more than 50% difference)
    const changePercentage = Math.abs((recentAvg - previousAvg) / previousAvg);
    return changePercentage > 0.5;
  }

  /**
   * Detect seasonal anomalies (placeholder implementation)
   */
  detectSeasonalAnomalies(values: number[], period: number = 24): boolean {
    // This would require more sophisticated seasonal decomposition
    // For now, return false as a placeholder
    return false;
  }

  /**
   * Detect anomalies in log patterns
   */
  private async detectLogPatternAnomalies(): Promise<void> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 10 * 60 * 1000); // Last 10 minutes

    // Check for error spikes
    const errorLogs = await this.logEntryRepository.count({
      where: {
        level: LogLevel.ERROR,
        timestamp: Between(startTime, endTime),
      },
    });

    // Check for unusual error patterns
    const previousEndTime = startTime;
    const previousStartTime = new Date(previousEndTime.getTime() - 10 * 60 * 1000);
    
    const previousErrorLogs = await this.logEntryRepository.count({
      where: {
        level: LogLevel.ERROR,
        timestamp: Between(previousStartTime, previousEndTime),
      },
    });

    if (errorLogs > previousErrorLogs * 3) { // 3x increase
      await this.createAnomalyAlert(
        {
          id: 'error-log-spike',
          name: 'Error Log Spike',
          type: AnomalyType.PATTERN,
          threshold: previousErrorLogs * 3,
          operator: 'gt',
          timeWindow: 10,
          severity: AnomalySeverity.HIGH,
          description: 'Unusual spike in error logs detected',
          enabled: true,
        },
        errorLogs,
      );
    }
  }

  /**
   * Detect anomalies in user behavior patterns
   */
  private async detectUserBehaviorAnomalies(): Promise<void> {
    // Check for unusual user activity patterns
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 60 * 60 * 1000); // Last hour

    const userRegistrations = await this.metricEntryRepository.count({
      where: {
        metricName: 'user_registrations',
        timestamp: Between(startTime, endTime),
      },
    });

    const courseEnrollments = await this.metricEntryRepository.count({
      where: {
        metricName: 'course_enrollments',
        timestamp: Between(startTime, endTime),
      },
    });

    // Check for unusual ratios
    if (userRegistrations > 0 && courseEnrollments / userRegistrations > 10) {
      await this.createAnomalyAlert(
        {
          id: 'unusual-enrollment-ratio',
          name: 'Unusual Enrollment to Registration Ratio',
          type: AnomalyType.BUSINESS_METRIC,
          threshold: 10,
          operator: 'gt',
          timeWindow: 60,
          severity: AnomalySeverity.MEDIUM,
          description: 'Unusually high enrollment to registration ratio detected',
          enabled: true,
        },
        courseEnrollments / userRegistrations,
      );
    }
  }

  /**
   * Create and save an anomaly alert
   */
  private async createAnomalyAlert(
    rule: Partial<AnomalyRule>,
    actualValue: number,
    correlationId?: string,
  ): Promise<void> {
    // Check if similar alert already exists (to avoid spam)
    const existingAlert = await this.anomalyAlertRepository.findOne({
      where: {
        alertType: rule.type,
        metricName: rule.metricName,
        status: AnomalyStatus.OPEN,
        timestamp: MoreThan(new Date(Date.now() - 30 * 60 * 1000)), // Last 30 minutes
      },
    });

    if (existingAlert) {
      this.logger.debug(`Similar anomaly alert already exists: ${rule.name}`);
      return;
    }

    const alert = new AnomalyAlert();
    alert.timestamp = new Date();
    alert.alertType = rule.type;
    alert.severity = rule.severity;
    alert.status = AnomalyStatus.OPEN;
    alert.title = rule.name;
    alert.description = rule.description;
    alert.serviceName = this.config.serviceName;
    alert.metricName = rule.metricName;
    alert.thresholdValue = rule.threshold;
    alert.actualValue = actualValue;
    alert.correlationId = correlationId;
    alert.detectionAlgorithm = 'statistical_analysis';

    if (rule.threshold) {
      alert.deviationPercentage = Math.abs((actualValue - rule.threshold) / rule.threshold) * 100;
    }

    await this.anomalyAlertRepository.save(alert);

    // Queue notification
    await this.anomalyQueue.add('send-alert-notification', {
      alertId: alert.id,
      severity: alert.severity,
      title: alert.title,
      description: alert.description,
    });

    this.logger.warn(`Anomaly detected: ${rule.name} - Actual: ${actualValue}, Threshold: ${rule.threshold}`);
  }

  /**
   * Acknowledge an anomaly alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string, notes?: string): Promise<void> {
    await this.anomalyAlertRepository.update(alertId, {
      status: AnomalyStatus.ACKNOWLEDGED,
      acknowledgedBy,
      acknowledgedAt: new Date(),
      resolutionNotes: notes,
    });

    this.logger.log(`Anomaly alert ${alertId} acknowledged by ${acknowledgedBy}`);
  }

  /**
   * Resolve an anomaly alert
   */
  async resolveAlert(alertId: string, resolvedBy: string, notes?: string): Promise<void> {
    await this.anomalyAlertRepository.update(alertId, {
      status: AnomalyStatus.RESOLVED,
      resolvedBy,
      resolvedAt: new Date(),
      resolutionNotes: notes,
    });

    this.logger.log(`Anomaly alert ${alertId} resolved by ${resolvedBy}`);
  }

  /**
   * Get active anomaly alerts
   */
  async getActiveAlerts(): Promise<AnomalyAlert[]> {
    return this.anomalyAlertRepository.find({
      where: {
        status: AnomalyStatus.OPEN,
      },
      order: {
        timestamp: 'DESC',
      },
    });
  }

  /**
   * Get anomaly statistics
   */
  async getAnomalyStats(startTime: Date, endTime: Date): Promise<{
    total: number;
    bySeverity: Record<AnomalySeverity, number>;
    byType: Record<AnomalyType, number>;
    resolved: number;
    acknowledged: number;
    open: number;
  }> {
    const alerts = await this.anomalyAlertRepository.find({
      where: {
        timestamp: Between(startTime, endTime),
      },
    });

    const stats = {
      total: alerts.length,
      bySeverity: {
        [AnomalySeverity.LOW]: 0,
        [AnomalySeverity.MEDIUM]: 0,
        [AnomalySeverity.HIGH]: 0,
        [AnomalySeverity.CRITICAL]: 0,
      },
      byType: {
        [AnomalyType.PERFORMANCE]: 0,
        [AnomalyType.ERROR_RATE]: 0,
        [AnomalyType.BUSINESS_METRIC]: 0,
        [AnomalyType.SECURITY]: 0,
        [AnomalyType.RESOURCE_USAGE]: 0,
        [AnomalyType.PATTERN]: 0,
      },
      resolved: 0,
      acknowledged: 0,
      open: 0,
    };

    alerts.forEach(alert => {
      stats.bySeverity[alert.severity]++;
      stats.byType[alert.alertType]++;
      
      switch (alert.status) {
        case AnomalyStatus.RESOLVED:
          stats.resolved++;
          break;
        case AnomalyStatus.ACKNOWLEDGED:
          stats.acknowledged++;
          break;
        case AnomalyStatus.OPEN:
          stats.open++;
          break;
      }
    });

    return stats;
  }

  async getAnomalyCount(from: Date, to: Date): Promise<number> {
    return this.anomalyAlertRepository.count({
      where: {
        timestamp: Between(from, to),
      },
    });
  }

  async searchAnomalies(query: {
    text?: string;
    correlationId?: string;
    startTime?: Date;
    endTime?: Date;
    services?: string[];
  }): Promise<any[]> {
    const whereConditions: any = {};

    if (query.correlationId) {
      whereConditions.correlationId = query.correlationId;
    }

    if (query.startTime && query.endTime) {
      whereConditions.timestamp = Between(query.startTime, query.endTime);
    }

    if (query.services) {
      whereConditions.serviceName = query.services;
    }

    const results = await this.anomalyAlertRepository.find({
      where: whereConditions,
      order: { timestamp: 'DESC' },
    });

    // Filter by text if provided
    if (query.text) {
      return results.filter(alert =>
        alert.title.toLowerCase().includes(query.text.toLowerCase()) ||
        alert.description.toLowerCase().includes(query.text.toLowerCase())
      );
    }

    return results;
  }

  async getHealthStatus(): Promise<{ status: string }> {
    return { status: 'healthy' };
  }
}
