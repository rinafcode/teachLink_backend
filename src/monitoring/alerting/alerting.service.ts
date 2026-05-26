import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import axios from 'axios';

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface IAlertRule {
  metricName: string;
  description: string;
  warningThreshold: number;
  criticalThreshold: number;
  unit: string;
  /** true = alert when value exceeds threshold; false = alert when value falls below */
  alertWhenAbove: boolean;
  cooldownMs: number;
}

export interface IAlertEvent {
  id: string;
  type: string;
  message: string;
  severity: AlertSeverity;
  firedAt: Date;
  metadata?: Record<string, unknown>;
}

export const ALERT_RULES: IAlertRule[] = [
  {
    metricName: 'cpu_load',
    description: 'CPU Load',
    warningThreshold: 75,
    criticalThreshold: 90,
    unit: '%',
    alertWhenAbove: true,
    cooldownMs: 5 * 60 * 1000,
  },
  {
    metricName: 'memory_usage',
    description: 'Memory Usage',
    warningThreshold: 80,
    criticalThreshold: 95,
    unit: '%',
    alertWhenAbove: true,
    cooldownMs: 5 * 60 * 1000,
  },
  {
    metricName: 'http_p95_latency_ms',
    description: 'HTTP P95 Response Latency',
    warningThreshold: 1000,
    criticalThreshold: 3000,
    unit: 'ms',
    alertWhenAbove: true,
    cooldownMs: 3 * 60 * 1000,
  },
  {
    metricName: 'db_query_duration_ms',
    description: 'Database Query Duration',
    warningThreshold: 500,
    criticalThreshold: 2000,
    unit: 'ms',
    alertWhenAbove: true,
    cooldownMs: 3 * 60 * 1000,
  },
  {
    metricName: 'cache_hit_rate',
    description: 'Cache Hit Rate',
    warningThreshold: 60,
    criticalThreshold: 40,
    unit: '%',
    alertWhenAbove: false,
    cooldownMs: 10 * 60 * 1000,
  },
  {
    metricName: 'queue_processing_time_ms',
    description: 'Queue Job Processing Time',
    warningThreshold: 5000,
    criticalThreshold: 15000,
    unit: 'ms',
    alertWhenAbove: true,
    cooldownMs: 5 * 60 * 1000,
  },
  {
    metricName: 'http_error_rate',
    description: 'HTTP Error Rate (5xx)',
    warningThreshold: 1,
    criticalThreshold: 5,
    unit: '%',
    alertWhenAbove: true,
    cooldownMs: 3 * 60 * 1000,
  },
  {
    metricName: 'active_connections',
    description: 'Active Database Connections',
    warningThreshold: 80,
    criticalThreshold: 95,
    unit: '%',
    alertWhenAbove: true,
    cooldownMs: 5 * 60 * 1000,
  },
];

/**
 * Provides alerting operations.
 */
@Injectable()
export class AlertingService {
  private readonly logger = new Logger(AlertingService.name);

  /** Tracks the last time each alert type fired to enforce cooldown */
  private readonly lastFiredAt = new Map<string, Date>();

  /** In-memory ring buffer of recent alerts (capped at 200) */
  private readonly recentAlerts: IAlertEvent[] = [];
  private readonly maxRecentAlerts = 200;

  private readonly emailEnabled: boolean;
  private readonly slackEnabled: boolean;
  private readonly alertEmailRecipients: string[];
  private readonly slackWebhookUrl: string | undefined;
  private readonly emailFrom: string;
  private mailerTransport: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    this.emailFrom = this.configService.get<string>('EMAIL_FROM', 'noreply@teachlink.io');
    const recipientRaw = this.configService.get<string>('ALERT_EMAIL_RECIPIENTS', '');
    this.alertEmailRecipients = recipientRaw
      ? recipientRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    this.emailEnabled = this.alertEmailRecipients.length > 0;

    this.slackWebhookUrl = this.configService.get<string>('ALERT_SLACK_WEBHOOK_URL');
    this.slackEnabled = !!this.slackWebhookUrl;

    if (this.emailEnabled) {
      this.mailerTransport = nodemailer.createTransport({
        host: this.configService.get<string>('SMTP_HOST', 'smtp.mailtrap.io'),
        port: this.configService.get<number>('SMTP_PORT', 587),
        secure: this.configService.get<string>('SMTP_SECURE', 'false') === 'true',
        auth: {
          user: this.configService.get<string>('SMTP_USER', ''),
          pass: this.configService.get<string>('SMTP_PASS', ''),
        },
      });
    }
  }

  /**
   * Send an alert through all configured notification channels.
   * Applies per-type cooldown to prevent alert storms.
   */
  sendAlert(
    type: string,
    message: string,
    severity: AlertSeverity,
    metadata?: Record<string, unknown>,
  ): void {
    if (this.isCoolingDown(type)) {
      return;
    }

    const event = this.buildEvent(type, message, severity, metadata);
    this.recordAlert(event);
    this.dispatchToChannels(event);
  }

  /**
   * Evaluate a metric value against defined alert rules and fire alerts
   * automatically when thresholds are breached.
   */
  evaluateMetricThreshold(metricName: string, value: number): void {
    const rule = ALERT_RULES.find((r) => r.metricName === metricName);
    if (!rule) {
      return;
    }

    const breachesCritical = rule.alertWhenAbove
      ? value >= rule.criticalThreshold
      : value <= rule.criticalThreshold;

    const breachesWarning = rule.alertWhenAbove
      ? value >= rule.warningThreshold
      : value <= rule.warningThreshold;

    if (breachesCritical) {
      this.sendAlert(
        `${metricName.toUpperCase()}_CRITICAL`,
        `${rule.description} is ${value.toFixed(2)}${rule.unit} — exceeds critical threshold of ${rule.criticalThreshold}${rule.unit}`,
        'CRITICAL',
        { metricName, value, threshold: rule.criticalThreshold },
      );
    } else if (breachesWarning) {
      this.sendAlert(
        `${metricName.toUpperCase()}_WARNING`,
        `${rule.description} is ${value.toFixed(2)}${rule.unit} — exceeds warning threshold of ${rule.warningThreshold}${rule.unit}`,
        'WARNING',
        { metricName, value, threshold: rule.warningThreshold },
      );
    }
  }

  getRecentAlerts(limit = 50): IAlertEvent[] {
    return this.recentAlerts.slice(-Math.min(limit, this.maxRecentAlerts));
  }

  getAlertRules(): IAlertRule[] {
    return ALERT_RULES;
  }

  private isCoolingDown(type: string): boolean {
    const rule = ALERT_RULES.find(
      (r) =>
        type === `${r.metricName.toUpperCase()}_CRITICAL` ||
        type === `${r.metricName.toUpperCase()}_WARNING`,
    );
    const cooldownMs = rule?.cooldownMs ?? 60_000;
    const lastFired = this.lastFiredAt.get(type);
    if (!lastFired) {
      return false;
    }
    return Date.now() - lastFired.getTime() < cooldownMs;
  }

  private buildEvent(
    type: string,
    message: string,
    severity: AlertSeverity,
    metadata?: Record<string, unknown>,
  ): IAlertEvent {
    return {
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      message,
      severity,
      firedAt: new Date(),
      metadata,
    };
  }

  private recordAlert(event: IAlertEvent): void {
    this.lastFiredAt.set(event.type, event.firedAt);
    this.recentAlerts.push(event);
    if (this.recentAlerts.length > this.maxRecentAlerts) {
      this.recentAlerts.splice(0, this.recentAlerts.length - this.maxRecentAlerts);
    }
  }

  private dispatchToChannels(event: IAlertEvent): void {
    this.logAlert(event);

    if (this.emailEnabled) {
      this.sendEmailAlert(event).catch((err) =>
        this.logger.error(`Email alert delivery failed: ${err.message}`),
      );
    }

    if (this.slackEnabled) {
      this.sendSlackAlert(event).catch((err) =>
        this.logger.error(`Slack alert delivery failed: ${err.message}`),
      );
    }
  }

  private logAlert(event: IAlertEvent): void {
    const line = `[ALERT][${event.severity}] ${event.type}: ${event.message}`;
    if (event.severity === 'CRITICAL') {
      this.logger.error(line);
    } else if (event.severity === 'WARNING') {
      this.logger.warn(line);
    } else {
      this.logger.log(line);
    }
  }

  private async sendEmailAlert(event: IAlertEvent): Promise<void> {
    if (!this.mailerTransport) {
      return;
    }

    const severityEmoji =
      event.severity === 'CRITICAL' ? '🔴' : event.severity === 'WARNING' ? '🟡' : '🟢';

    await this.mailerTransport.sendMail({
      from: this.emailFrom,
      to: this.alertEmailRecipients.join(', '),
      subject: `${severityEmoji} [${event.severity}] TeachLink Alert: ${event.type}`,
      text: this.buildEmailText(event),
      html: this.buildEmailHtml(event, severityEmoji),
    });
  }

  private buildEmailText(event: IAlertEvent): string {
    return [
      `Alert ID: ${event.id}`,
      `Type: ${event.type}`,
      `Severity: ${event.severity}`,
      `Time: ${event.firedAt.toISOString()}`,
      `Message: ${event.message}`,
      event.metadata ? `Details: ${JSON.stringify(event.metadata, null, 2)}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildEmailHtml(event: IAlertEvent, emoji: string): string {
    const color =
      event.severity === 'CRITICAL'
        ? '#dc2626'
        : event.severity === 'WARNING'
          ? '#d97706'
          : '#16a34a';
    const detailsRow = event.metadata
      ? `<tr><td><strong>Details</strong></td><td><pre style="background:#f3f4f6;padding:8px;border-radius:4px">${JSON.stringify(event.metadata, null, 2)}</pre></td></tr>`
      : '';

    return `
      <div style="font-family:sans-serif;max-width:600px">
        <div style="background:${color};color:#fff;padding:16px;border-radius:8px 8px 0 0">
          <h2 style="margin:0">${emoji} ${event.severity} Alert</h2>
          <p style="margin:4px 0 0">${event.type}</p>
        </div>
        <div style="border:1px solid #e5e7eb;border-top:none;padding:16px;border-radius:0 0 8px 8px">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:4px 8px"><strong>Alert ID</strong></td><td>${event.id}</td></tr>
            <tr><td style="padding:4px 8px"><strong>Time</strong></td><td>${event.firedAt.toISOString()}</td></tr>
            <tr><td style="padding:4px 8px"><strong>Message</strong></td><td>${event.message}</td></tr>
            ${detailsRow}
          </table>
        </div>
      </div>`;
  }

  private async sendSlackAlert(event: IAlertEvent): Promise<void> {
    if (!this.slackWebhookUrl) {
      return;
    }

    const color =
      event.severity === 'CRITICAL'
        ? '#dc2626'
        : event.severity === 'WARNING'
          ? '#d97706'
          : '#16a34a';
    const body = {
      attachments: [
        {
          color,
          title: `[${event.severity}] ${event.type}`,
          text: event.message,
          fields: [
            { title: 'Alert ID', value: event.id, short: true },
            { title: 'Time', value: event.firedAt.toISOString(), short: true },
            ...(event.metadata
              ? [
                  {
                    title: 'Details',
                    value: `\`\`\`${JSON.stringify(event.metadata, null, 2)}\`\`\``,
                    short: false,
                  },
                ]
              : []),
          ],
          footer: 'TeachLink Monitoring',
          ts: Math.floor(event.firedAt.getTime() / 1000),
        },
      ],
    };

    await axios.post(this.slackWebhookUrl, body);
  }
}
