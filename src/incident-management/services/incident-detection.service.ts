import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Incident, IncidentStatus, IncidentSeverity } from '../entities/incident.entity';
import { IAlertEvent } from '../../monitoring/alerting/alerting.service';

export interface IncidentDetectionRule {
  name: string;
  alertPattern: RegExp;
  incidentTitle: string;
  incidentDescription: string;
  runbookId?: string;
  requiredConsecutiveAlerts: number;
}

// Detection rules mapping alert patterns to incidents
export const INCIDENT_DETECTION_RULES: IncidentDetectionRule[] = [
  {
    name: 'database_failure_detection',
    alertPattern: /db_query_duration_ms|active_connections|database/i,
    incidentTitle: 'Database Performance Degradation Detected',
    incidentDescription:
      'Database query duration or active connections exceeded critical threshold',
    runbookId: 'database-failure',
    requiredConsecutiveAlerts: 2,
  },
  {
    name: 'high_cpu_memory_detection',
    alertPattern: /cpu_load|memory_usage/i,
    incidentTitle: 'High Resource Utilization Detected',
    incidentDescription: 'CPU load or memory usage has exceeded warning threshold',
    runbookId: 'resource-scaling',
    requiredConsecutiveAlerts: 3,
  },
  {
    name: 'high_error_rate_detection',
    alertPattern: /http_error_rate/i,
    incidentTitle: 'High HTTP Error Rate Detected',
    incidentDescription: 'HTTP error rate (5xx) has increased significantly',
    runbookId: 'error-rate-investigation',
    requiredConsecutiveAlerts: 2,
  },
  {
    name: 'cache_hit_rate_degradation',
    alertPattern: /cache_hit_rate/i,
    incidentTitle: 'Cache Hit Rate Degradation',
    incidentDescription: 'Cache hit rate has fallen below acceptable threshold',
    runbookId: 'cache-investigation',
    requiredConsecutiveAlerts: 2,
  },
  {
    name: 'queue_processing_delay',
    alertPattern: /queue_processing_time_ms/i,
    incidentTitle: 'Queue Processing Delay Detected',
    incidentDescription: 'Background job processing time has increased significantly',
    runbookId: 'queue-investigation',
    requiredConsecutiveAlerts: 2,
  },
  {
    name: 'api_latency_issue',
    alertPattern: /http_p95_latency_ms/i,
    incidentTitle: 'API Latency Issue Detected',
    incidentDescription: 'HTTP P95 response latency has exceeded acceptable threshold',
    runbookId: 'latency-investigation',
    requiredConsecutiveAlerts: 2,
  },
];

@Injectable()
export class IncidentDetectionService {
  private readonly logger = new Logger(IncidentDetectionService.name);
  private alertHistory: Map<string, IAlertEvent[]> = new Map();

  constructor(
    @InjectRepository(Incident)
    private incidentRepository: Repository<Incident>,
  ) {}

  /**
   * Process incoming alerts and detect incidents
   */
  async processAlert(alert: IAlertEvent): Promise<Incident | null> {
    this.logger.debug(`Processing alert: ${alert.type} - ${alert.message}`);

    // Track alert history for pattern detection
    this.recordAlertHistory(alert.type, alert);

    // Check if alert matches any detection rules
    const detectionRule = this.findMatchingRule(alert.type);
    if (!detectionRule) {
      this.logger.debug(`No incident detection rule matched for alert: ${alert.type}`);
      return null;
    }

    // Check if we have enough consecutive alerts to trigger incident
    const consecutiveCount = this.getConsecutiveAlertCount(alert.type);
    if (consecutiveCount < detectionRule.requiredConsecutiveAlerts) {
      this.logger.debug(
        `Insufficient consecutive alerts (${consecutiveCount}/${detectionRule.requiredConsecutiveAlerts}) for incident detection`,
      );
      return null;
    }

    // Check if incident already exists for this pattern
    const existingIncident = await this.findActiveIncidentByPattern(detectionRule.name);
    if (existingIncident) {
      this.logger.debug(`Active incident already exists for pattern: ${detectionRule.name}`);
      return existingIncident;
    }

    // Create new incident
    const incident = await this.createIncident(detectionRule, alert, consecutiveCount);

    this.logger.warn(
      `Incident detected: ${incident.title} (ID: ${incident.id}, Severity: ${incident.severity})`,
    );

    return incident;
  }

  /**
   * Find matching detection rule for alert type
   */
  private findMatchingRule(alertType: string): IncidentDetectionRule | undefined {
    return INCIDENT_DETECTION_RULES.find((rule) => rule.alertPattern.test(alertType));
  }

  /**
   * Record alert in history for pattern analysis
   */
  private recordAlertHistory(alertType: string, alert: IAlertEvent): void {
    if (!this.alertHistory.has(alertType)) {
      this.alertHistory.set(alertType, []);
    }

    const history = this.alertHistory.get(alertType)!;
    history.push(alert);

    // Keep only last 24 hours of alerts (keep max 100 per type)
    if (history.length > 100) {
      history.shift();
    }

    // Clean up old alerts (older than 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const index = history.findIndex((a) => a.firedAt > oneDayAgo);
    if (index > 0) {
      this.alertHistory.set(alertType, history.slice(index));
    }
  }

  /**
   * Get count of consecutive alerts of same type
   */
  private getConsecutiveAlertCount(alertType: string): number {
    const history = this.alertHistory.get(alertType);
    if (!history || history.length === 0) return 0;

    // Count consecutive CRITICAL and WARNING alerts
    let count = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      const alert = history[i];
      if (['CRITICAL', 'WARNING'].includes(alert.severity)) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  /**
   * Find active incident matching a detection pattern
   */
  private async findActiveIncidentByPattern(patternName: string): Promise<Incident | null> {
    return this.incidentRepository.findOne({
      where: {
        runbookId: patternName,
        status: IncidentStatus.DETECTED,
      },
    });
  }

  /**
   * Create new incident from detection rule and alert
   */
  private async createIncident(
    rule: IncidentDetectionRule,
    alert: IAlertEvent,
    consecutiveCount: number,
  ): Promise<Incident> {
    const severity =
      alert.severity === 'CRITICAL'
        ? IncidentSeverity.CRITICAL
        : alert.severity === 'WARNING'
          ? IncidentSeverity.WARNING
          : IncidentSeverity.INFO;

    const incident = this.incidentRepository.create({
      title: rule.incidentTitle,
      description: rule.incidentDescription,
      severity,
      status: IncidentStatus.DETECTED,
      triggerMetrics: {
        ...alert.metadata,
        consecutiveAlerts: consecutiveCount,
        alertType: alert.type,
      },
      runbookId: rule.runbookId,
    });

    return this.incidentRepository.save(incident);
  }

  /**
   * Get incident detection statistics
   */
  async getDetectionStats(): Promise<{
    totalAlerts: number;
    alertTypes: Record<string, number>;
    detectionRules: number;
  }> {
    const totalAlerts = Array.from(this.alertHistory.values()).reduce(
      (sum, alerts) => sum + alerts.length,
      0,
    );

    const alertTypes: Record<string, number> = {};
    this.alertHistory.forEach((alerts, type) => {
      alertTypes[type] = alerts.length;
    });

    return {
      totalAlerts,
      alertTypes,
      detectionRules: INCIDENT_DETECTION_RULES.length,
    };
  }

  /**
   * Clear alert history (useful for testing and cleanup)
   */
  clearAlertHistory(): void {
    this.alertHistory.clear();
    this.logger.debug('Alert history cleared');
  }
}
