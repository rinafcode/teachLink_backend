import { Injectable, Logger } from '@nestjs/common';
import type { PerformanceMetrics } from '../monitoring.service';
import type { PerformanceAnalysis } from '../performance/performance-analysis.service';

export interface Alert {
  id: string;
  type: 'performance' | 'error' | 'regression' | 'threshold';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  metric: string;
  currentValue: number;
  threshold: number;
  timestamp: Date;
  acknowledged: boolean;
  resolvedAt?: Date;
  actions: AlertAction[];
}

export interface AlertAction {
  type: 'email' | 'slack' | 'webhook' | 'sms';
  target: string;
  sent: boolean;
  sentAt?: Date;
  error?: string;
}

export interface AlertThreshold {
  metric: string;
  warning: number;
  critical: number;
  enabled: boolean;
  cooldownMinutes: number;
}

@Injectable()
export class AlertingService {
  private readonly logger = new Logger(AlertingService.name);
  private activeAlerts: Alert[] = [];
  private alertHistory: Alert[] = [];
  private lastAlertTimes: Map<string, Date> = new Map();

  // Default alert thresholds
  private thresholds: AlertThreshold[] = [
    {
      metric: 'cpu_usage',
      warning: 70,
      critical: 85,
      enabled: true,
      cooldownMinutes: 5,
    },
    {
      metric: 'memory_usage',
      warning: 80,
      critical: 90,
      enabled: true,
      cooldownMinutes: 5,
    },
    {
      metric: 'response_time',
      warning: 500,
      critical: 1000,
      enabled: true,
      cooldownMinutes: 2,
    },
    {
      metric: 'error_rate',
      warning: 1,
      critical: 5,
      enabled: true,
      cooldownMinutes: 1,
    },
    {
      metric: 'database_connections',
      warning: 80,
      critical: 95,
      enabled: true,
      cooldownMinutes: 3,
    },
    {
      metric: 'event_loop_delay',
      warning: 10,
      critical: 50,
      enabled: true,
      cooldownMinutes: 2,
    },
  ];

  async checkThresholds(
    metrics: PerformanceMetrics,
    analysis: PerformanceAnalysis,
  ): Promise<void> {
    // Check CPU usage
    await this.checkMetricThreshold(
      'cpu_usage',
      metrics.cpu.usage,
      'CPU Usage',
      `${metrics.cpu.usage.toFixed(1)}%`,
      'High CPU usage detected',
    );

    // Check memory usage
    const memoryUsagePercent =
      (metrics.memory.used / metrics.memory.total) * 100;
    await this.checkMetricThreshold(
      'memory_usage',
      memoryUsagePercent,
      'Memory Usage',
      `${memoryUsagePercent.toFixed(1)}%`,
      'High memory usage detected',
    );

    // Check response time
    await this.checkMetricThreshold(
      'response_time',
      metrics.http.avgResponseTime,
      'Response Time',
      `${metrics.http.avgResponseTime.toFixed(2)}ms`,
      'Slow response times detected',
    );

    // Check error rate
    await this.checkMetricThreshold(
      'error_rate',
      metrics.http.errorRate,
      'Error Rate',
      `${metrics.http.errorRate.toFixed(2)}%`,
      'High error rate detected',
    );

    // Check database connections (assuming max 100 connections)
    const dbConnectionPercent =
      (metrics.database.activeConnections / 100) * 100;
    await this.checkMetricThreshold(
      'database_connections',
      dbConnectionPercent,
      'Database Connections',
      `${metrics.database.activeConnections} active`,
      'High database connection usage',
    );

    // Check event loop delay
    await this.checkMetricThreshold(
      'event_loop_delay',
      metrics.eventLoop.delay,
      'Event Loop Delay',
      `${metrics.eventLoop.delay.toFixed(2)}ms`,
      'Event loop blocking detected',
    );

    // Check for critical issues
    if (analysis.criticalIssues.length > 0) {
      await this.createCriticalIssueAlert(analysis.criticalIssues);
    }
  }

  private async checkMetricThreshold(
    metricKey: string,
    currentValue: number,
    metricName: string,
    valueDisplay: string,
    baseMessage: string,
  ): Promise<void> {
    const threshold = this.thresholds.find((t) => t.metric === metricKey);
    if (!threshold || !threshold.enabled) {
      return;
    }

    // Check cooldown period
    const lastAlertTime = this.lastAlertTimes.get(metricKey);
    const cooldownMs = threshold.cooldownMinutes * 60 * 1000;
    if (lastAlertTime && Date.now() - lastAlertTime.getTime() < cooldownMs) {
      return;
    }

    let severity: 'low' | 'medium' | 'high' | 'critical' | null = null;
    let thresholdValue = 0;

    if (currentValue >= threshold.critical) {
      severity = 'critical';
      thresholdValue = threshold.critical;
    } else if (currentValue >= threshold.warning) {
      severity = 'high';
      thresholdValue = threshold.warning;
    }

    if (severity) {
      const alert = await this.createAlert({
        type: 'threshold',
        severity,
        title: `${metricName} ${severity === 'critical' ? 'Critical' : 'Warning'}`,
        message: `${baseMessage}: ${valueDisplay} (threshold: ${thresholdValue})`,
        metric: metricKey,
        currentValue,
        threshold: thresholdValue,
      });

      this.lastAlertTimes.set(metricKey, new Date());
      await this.sendAlert(alert);
    }
  }

  private async createAlert(alertData: Partial<Alert>): Promise<Alert> {
    const alert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: alertData.type || 'performance',
      severity: alertData.severity || 'medium',
      title: alertData.title || 'Performance Alert',
      message: alertData.message || 'Performance threshold exceeded',
      metric: alertData.metric || 'unknown',
      currentValue: alertData.currentValue || 0,
      threshold: alertData.threshold || 0,
      timestamp: new Date(),
      acknowledged: false,
      actions: this.getAlertActions(alertData.severity || 'medium'),
    };

    this.activeAlerts.push(alert);
    this.alertHistory.push(alert);

    this.logger.warn(`Alert created: ${alert.title}`, {
      id: alert.id,
      severity: alert.severity,
      metric: alert.metric,
      currentValue: alert.currentValue,
      threshold: alert.threshold,
    });

    return alert;
  }

  private getAlertActions(severity: string): AlertAction[] {
    const actions: AlertAction[] = [];

    // Email notifications for all alerts
    actions.push({
      type: 'email',
      target: 'admin@example.com',
      sent: false,
    });

    // Slack for high and critical alerts
    if (severity === 'high' || severity === 'critical') {
      actions.push({
        type: 'slack',
        target: '#alerts',
        sent: false,
      });
    }

    // SMS for critical alerts
    if (severity === 'critical') {
      actions.push({
        type: 'sms',
        target: '+1234567890',
        sent: false,
      });
    }

    // Webhook for all alerts
    actions.push({
      type: 'webhook',
      target: 'https://your-webhook-url.com/alerts',
      sent: false,
    });

    return actions;
  }

  private async sendAlert(alert: Alert): Promise<void> {
    for (const action of alert.actions) {
      try {
        await this.executeAlertAction(alert, action);
        action.sent = true;
        action.sentAt = new Date();
      } catch (error) {
        action.error = error.message;
        this.logger.error(`Failed to send alert via ${action.type}`, error);
      }
    }
  }

  private async executeAlertAction(
    alert: Alert,
    action: AlertAction,
  ): Promise<void> {
    switch (action.type) {
      case 'email':
        await this.sendEmailAlert(alert, action.target);
        break;
      case 'slack':
        await this.sendSlackAlert(alert, action.target);
        break;
      case 'sms':
        await this.sendSmsAlert(alert, action.target);
        break;
      case 'webhook':
        await this.sendWebhookAlert(alert, action.target);
        break;
      default:
        throw new Error(`Unknown alert action type: ${action.type}`);
    }
  }

  private async sendEmailAlert(alert: Alert, email: string): Promise<void> {
    // In a real implementation, you would use a service like SendGrid, AWS SES, etc.
    this.logger.log(`Email alert sent to ${email}: ${alert.title}`);

    // Simulate email sending
    const emailContent = {
      to: email,
      subject: `[${alert.severity.toUpperCase()}] ${alert.title}`,
      body: `
        Alert Details:
        - Type: ${alert.type}
        - Severity: ${alert.severity}
        - Message: ${alert.message}
        - Metric: ${alert.metric}
        - Current Value: ${alert.currentValue}
        - Threshold: ${alert.threshold}
        - Timestamp: ${alert.timestamp.toISOString()}
        
        Please investigate and take appropriate action.
      `,
    };

    // Here you would actually send the email
    this.logger.debug('Email content prepared', emailContent);
  }

  private async sendSlackAlert(alert: Alert, channel: string): Promise<void> {
    // In a real implementation, you would use Slack's Web API
    this.logger.log(`Slack alert sent to ${channel}: ${alert.title}`);

    const slackMessage = {
      channel,
      text: `🚨 *${alert.title}*`,
      attachments: [
        {
          color: this.getSlackColor(alert.severity),
          fields: [
            { title: 'Severity', value: alert.severity, short: true },
            { title: 'Metric', value: alert.metric, short: true },
            {
              title: 'Current Value',
              value: alert.currentValue.toString(),
              short: true,
            },
            {
              title: 'Threshold',
              value: alert.threshold.toString(),
              short: true,
            },
            { title: 'Message', value: alert.message, short: false },
          ],
          timestamp: Math.floor(alert.timestamp.getTime() / 1000),
        },
      ],
    };

    // Here you would actually send to Slack
    this.logger.debug('Slack message prepared', slackMessage);
  }

  private getSlackColor(severity: string): string {
    switch (severity) {
      case 'critical':
        return 'danger';
      case 'high':
        return 'warning';
      case 'medium':
        return 'good';
      default:
        return '#439FE0';
    }
  }

  private async sendSmsAlert(alert: Alert, phoneNumber: string): Promise<void> {
    // In a real implementation, you would use a service like Twilio, AWS SNS, etc.
    this.logger.log(`SMS alert sent to ${phoneNumber}: ${alert.title}`);

    const smsMessage = `ALERT: ${alert.title} - ${alert.message} (${alert.currentValue}/${alert.threshold})`;

    // Here you would actually send the SMS
    this.logger.debug('SMS message prepared', {
      to: phoneNumber,
      message: smsMessage,
    });
  }

  private async sendWebhookAlert(
    alert: Alert,
    webhookUrl: string,
  ): Promise<void> {
    // In a real implementation, you would make an HTTP POST request
    this.logger.log(`Webhook alert sent to ${webhookUrl}: ${alert.title}`);

    const webhookPayload = {
      alert_id: alert.id,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      metric: alert.metric,
      current_value: alert.currentValue,
      threshold: alert.threshold,
      timestamp: alert.timestamp.toISOString(),
    };

    // Here you would actually make the HTTP request
    // Example: await fetch(webhookUrl, { method: 'POST', body: JSON.stringify(webhookPayload) });
    this.logger.debug('Webhook payload prepared', webhookPayload);
  }

  private async createCriticalIssueAlert(criticalIssues: any[]): Promise<void> {
    const alert = await this.createAlert({
      type: 'error',
      severity: 'critical',
      title: `${criticalIssues.length} Critical Performance Issues Detected`,
      message: `Critical issues found: ${criticalIssues.map((i) => i.description).join(', ')}`,
      metric: 'critical_issues',
      currentValue: criticalIssues.length,
      threshold: 0,
    });

    await this.sendAlert(alert);
  }

  async sendRegressionAlert(analysis: PerformanceAnalysis): Promise<void> {
    const alert = await this.createAlert({
      type: 'regression',
      severity: 'high',
      title: 'Performance Regression Detected',
      message:
        'Significant performance degradation detected compared to baseline',
      metric: 'performance_regression',
      currentValue: 1,
      threshold: 0,
    });

    await this.sendAlert(alert);
  }

  async getActiveAlerts(): Promise<Alert[]> {
    return this.activeAlerts.filter(
      (alert) => !alert.acknowledged && !alert.resolvedAt,
    );
  }

  async acknowledgeAlert(alertId: string): Promise<void> {
    const alert = this.activeAlerts.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.logger.log(`Alert acknowledged: ${alertId}`);
    }
  }

  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.activeAlerts.find((a) => a.id === alertId);
    if (alert) {
      alert.resolvedAt = new Date();
      this.logger.log(`Alert resolved: ${alertId}`);
    }
  }

  async updateThreshold(
    metric: string,
    warning: number,
    critical: number,
  ): Promise<void> {
    const threshold = this.thresholds.find((t) => t.metric === metric);
    if (threshold) {
      threshold.warning = warning;
      threshold.critical = critical;
      this.logger.log(
        `Updated threshold for ${metric}: warning=${warning}, critical=${critical}`,
      );
    }
  }

  async getAlertHistory(limit = 100): Promise<Alert[]> {
    return this.alertHistory.slice(-limit);
  }

  async getAlertStatistics() {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recent24h = this.alertHistory.filter(
      (a) => a.timestamp >= last24Hours,
    );
    const recent7d = this.alertHistory.filter((a) => a.timestamp >= last7Days);

    return {
      total: this.alertHistory.length,
      active: (await this.getActiveAlerts()).length,
      last24Hours: recent24h.length,
      last7Days: recent7d.length,
      bySeverity: {
        critical: this.alertHistory.filter((a) => a.severity === 'critical')
          .length,
        high: this.alertHistory.filter((a) => a.severity === 'high').length,
        medium: this.alertHistory.filter((a) => a.severity === 'medium').length,
        low: this.alertHistory.filter((a) => a.severity === 'low').length,
      },
      byType: {
        performance: this.alertHistory.filter((a) => a.type === 'performance')
          .length,
        error: this.alertHistory.filter((a) => a.type === 'error').length,
        regression: this.alertHistory.filter((a) => a.type === 'regression')
          .length,
        threshold: this.alertHistory.filter((a) => a.type === 'threshold')
          .length,
      },
    };
  }
}
