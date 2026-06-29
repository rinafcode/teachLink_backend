import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import axios from 'axios';
import { Incident, IncidentSeverity } from '../entities/incident.entity';
import { RemediationAction } from '../entities/remediation-action.entity';
import { EnhancedCircuitBreakerService } from '../../common/services/circuit-breaker.service';

export enum NotificationChannel {
  EMAIL = 'email',
  SLACK = 'slack',
  PAGERDUTY = 'pagerduty',
  WEBHOOK = 'webhook',
}

export interface NotificationRecipient {
  channel: NotificationChannel;
  address: string; // email address, slack channel, or webhook URL
  severity?: IncidentSeverity[]; // Only notify for specific severity levels
}

export interface EscalationPolicy {
  delayMs: number;
  severity: IncidentSeverity;
  recipients: NotificationRecipient[];
  maxRetries: number;
}

@Injectable()
export class NotificationAndEscalationService {
  private readonly logger = new Logger(NotificationAndEscalationService.name);
  private emailTransporter: nodemailer.Transporter;
  private escalationPolicies: Map<string, EscalationPolicy> = new Map();

  constructor(
    private configService: ConfigService,
    private circuitBreakerService: EnhancedCircuitBreakerService,
  ) {
    this.initializeEmailTransport();
    this.initializeEscalationPolicies();
  }

  /**
   * Initialize email transport
   */
  private initializeEmailTransport(): void {
    const emailHost = this.configService.get('EMAIL_HOST');
    const emailPort = this.configService.get('EMAIL_PORT');
    const emailUser = this.configService.get('EMAIL_USER');
    const emailPassword = this.configService.get('EMAIL_PASSWORD');

    // Use default transport if not configured
    if (!emailHost) {
      this.emailTransporter = nodemailer.createTransport({
        host: 'smtp.mailtrap.io',
        port: 2525,
        auth: {
          user: 'demo',
          pass: 'demo',
        },
      });
    } else {
      this.emailTransporter = nodemailer.createTransport({
        host: emailHost,
        port: parseInt(emailPort || '587', 10),
        secure: emailPort === '465',
        auth: {
          user: emailUser,
          pass: emailPassword,
        },
      });
    }
  }

  /**
   * Initialize escalation policies
   */
  private initializeEscalationPolicies(): void {
    // Default escalation policies
    const policies: Record<string, EscalationPolicy> = {
      info: {
        delayMs: 5 * 60 * 1000, // 5 minutes
        severity: IncidentSeverity.INFO,
        recipients: [],
        maxRetries: 1,
      },
      warning: {
        delayMs: 3 * 60 * 1000, // 3 minutes
        severity: IncidentSeverity.WARNING,
        recipients: [
          {
            channel: NotificationChannel.SLACK,
            address: '#incidents',
            severity: [IncidentSeverity.WARNING, IncidentSeverity.CRITICAL],
          },
          {
            channel: NotificationChannel.EMAIL,
            address: 'ops-team@example.com',
            severity: [IncidentSeverity.WARNING, IncidentSeverity.CRITICAL],
          },
        ],
        maxRetries: 2,
      },
      critical: {
        delayMs: 1 * 60 * 1000, // 1 minute
        severity: IncidentSeverity.CRITICAL,
        recipients: [
          {
            channel: NotificationChannel.SLACK,
            address: '#critical-incidents',
            severity: [IncidentSeverity.CRITICAL],
          },
          {
            channel: NotificationChannel.EMAIL,
            address: 'oncall@example.com',
            severity: [IncidentSeverity.CRITICAL],
          },
          {
            channel: NotificationChannel.PAGERDUTY,
            address: 'incident-service-key',
            severity: [IncidentSeverity.CRITICAL],
          },
        ],
        maxRetries: 3,
      },
    };

    Object.entries(policies).forEach(([key, policy]) => {
      this.escalationPolicies.set(key, policy);
    });
  }

  /**
   * Notify incident detection
   */
  async notifyIncidentDetected(incident: Incident): Promise<void> {
    this.logger.log(`Notifying incident detected: ${incident.id} - ${incident.title}`);

    const policy = this.escalationPolicies.get(incident.severity.toLowerCase());
    if (!policy) {
      this.logger.warn(`No escalation policy found for severity: ${incident.severity}`);
      return;
    }

    // Filter recipients for this severity
    const recipients = policy.recipients.filter(
      (r) => !r.severity || r.severity.includes(incident.severity),
    );

    if (recipients.length === 0) {
      this.logger.debug(`No recipients configured for severity: ${incident.severity}`);
      return;
    }

    // Send notifications to all recipients
    const notificationPromises = recipients.map((recipient) =>
      this.sendNotification(recipient, incident, 'incident_detected'),
    );

    const results = await Promise.allSettled(notificationPromises);
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.error(
          `Failed to send notification to ${recipients[index].address}: ${result.reason}`,
        );
      }
    });
  }

  /**
   * Notify incident resolution
   */
  async notifyIncidentResolved(incident: Incident, resolutionTime: number): Promise<void> {
    this.logger.log(`Notifying incident resolved: ${incident.id} - ${incident.title}`);

    const policy = this.escalationPolicies.get(incident.severity.toLowerCase());
    if (!policy) return;

    const recipients = policy.recipients.filter(
      (r) => !r.severity || r.severity.includes(incident.severity),
    );

    const notificationPromises = recipients.map((recipient) =>
      this.sendNotification(recipient, incident, 'incident_resolved', resolutionTime),
    );

    await Promise.allSettled(notificationPromises);
  }

  /**
   * Notify remediation action execution
   */
  async notifyRemediationExecuted(incident: Incident, action: RemediationAction): Promise<void> {
    this.logger.log(`Notifying remediation execution: ${action.id} - ${action.actionType}`);

    const policy = this.escalationPolicies.get(incident.severity.toLowerCase());
    if (!policy) return;

    const recipients = policy.recipients.filter(
      (r) => !r.severity || r.severity.includes(incident.severity),
    );

    const notificationPromises = recipients.map((recipient) =>
      this.sendNotification(recipient, incident, 'remediation_executed', 0, action),
    );

    await Promise.allSettled(notificationPromises);
  }

  /**
   * Escalate incident to higher level
   */
  async escalateIncident(incident: Incident, escalatedTo: string, reason: string): Promise<void> {
    this.logger.warn(`Escalating incident: ${incident.id} to ${escalatedTo} - ${reason}`);

    // Send escalation notifications
    const escalationRecipient: NotificationRecipient = {
      channel: NotificationChannel.EMAIL,
      address: escalatedTo,
    };

    try {
      await this.sendNotification(
        escalationRecipient,
        incident,
        'incident_escalated',
        0,
        undefined,
        reason,
      );
    } catch (error) {
      this.logger.error(`Failed to escalate incident: ${error}`);
    }
  }

  /**
   * Send notification via appropriate channel
   */
  private async sendNotification(
    recipient: NotificationRecipient,
    incident: Incident,
    eventType: string,
    resolutionTime?: number,
    remediationAction?: RemediationAction,
    escalationReason?: string,
  ): Promise<void> {
    try {
      switch (recipient.channel) {
        case NotificationChannel.EMAIL:
          await this.sendEmailNotification(
            recipient.address,
            incident,
            eventType,
            resolutionTime,
            remediationAction,
            escalationReason,
          );
          break;

        case NotificationChannel.SLACK:
          await this.sendSlackNotification(
            recipient.address,
            incident,
            eventType,
            remediationAction,
          );
          break;

        case NotificationChannel.PAGERDUTY:
          await this.sendPagerDutyNotification(incident, eventType);
          break;

        case NotificationChannel.WEBHOOK:
          await this.sendWebhookNotification(recipient.address, incident, eventType);
          break;

        default:
          this.logger.warn(`Unknown notification channel: ${recipient.channel}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error sending ${recipient.channel} notification: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(
    email: string,
    incident: Incident,
    eventType: string,
    resolutionTime?: number,
    remediationAction?: RemediationAction,
    escalationReason?: string,
  ): Promise<void> {
    const subject = this.buildEmailSubject(incident, eventType);
    const html = this.buildEmailBody(
      incident,
      eventType,
      resolutionTime,
      remediationAction,
      escalationReason,
    );

    await this.emailTransporter.sendMail({
      from: this.configService.get('EMAIL_FROM') || 'noreply@teachlink.io',
      to: email,
      subject,
      html,
    });

    this.logger.log(`Email notification sent to ${email}`);
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(
    channel: string,
    incident: Incident,
    eventType: string,
    remediationAction?: RemediationAction,
  ): Promise<void> {
    const slackWebhook = this.configService.get('SLACK_WEBHOOK_URL');
    if (!slackWebhook) {
      this.logger.warn('Slack webhook URL not configured');
      return;
    }

    const color =
      incident.severity === IncidentSeverity.CRITICAL
        ? 'danger'
        : incident.severity === IncidentSeverity.WARNING
          ? 'warning'
          : 'good';

    const text = this.buildSlackMessage(incident, eventType, remediationAction);

    await this.circuitBreakerService.execute(
      'slack-notification',
      () =>
        axios.post(slackWebhook, {
          channel,
          attachments: [
            {
              color,
              title: incident.title,
              text,
              fields: [
                {
                  title: 'Severity',
                  value: incident.severity,
                  short: true,
                },
                {
                  title: 'Status',
                  value: incident.status,
                  short: true,
                },
                {
                  title: 'Incident ID',
                  value: incident.id,
                  short: false,
                },
              ],
              ts: Math.floor(Date.now() / 1000),
            },
          ],
        }),
      {
        timeout: 5000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        fallback: (error: Error) => {
          this.logger.warn(`Slack notification fallback triggered: ${error.message}`);
          return null;
        },
      },
    );

    this.logger.log(`Slack notification sent to ${channel}`);
  }

  /**
   * Send PagerDuty notification
   */
  private async sendPagerDutyNotification(incident: Incident, eventType: string): Promise<void> {
    const pagerDutyKey = this.configService.get('PAGERDUTY_INTEGRATION_KEY');
    if (!pagerDutyKey) {
      this.logger.warn('PagerDuty integration key not configured');
      return;
    }

    const eventAction =
      eventType === 'incident_detected'
        ? 'trigger'
        : eventType === 'incident_resolved'
          ? 'resolve'
          : 'acknowledge';

    await this.circuitBreakerService.execute(
      'pagerduty-notification',
      () =>
        axios.post('https://events.pagerduty.com/v2/enqueue', {
          routing_key: pagerDutyKey,
          event_action: eventAction,
          dedup_key: incident.id,
          payload: {
            summary: incident.title,
            severity: incident.severity.toLowerCase(),
            source: 'TeachLink Incident Management',
            custom_details: {
              description: incident.description,
              incidentId: incident.id,
            },
          },
        }),
      {
        timeout: 5000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        fallback: (error: Error) => {
          this.logger.warn(`PagerDuty notification fallback triggered: ${error.message}`);
          return null;
        },
      },
    );

    this.logger.log(`PagerDuty notification sent for incident ${incident.id}`);
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(
    webhookUrl: string,
    incident: Incident,
    eventType: string,
  ): Promise<void> {
    await this.circuitBreakerService.execute(
      `webhook-notification-${webhookUrl}`,
      () =>
        axios.post(webhookUrl, {
          eventType,
          incident: {
            id: incident.id,
            title: incident.title,
            description: incident.description,
            severity: incident.severity,
            status: incident.status,
            detectedAt: incident.detectedAt,
          },
        }),
      {
        timeout: 5000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        fallback: (error: Error) => {
          this.logger.warn(
            `Webhook notification fallback triggered for ${webhookUrl}: ${error.message}`,
          );
          return null;
        },
      },
    );

    this.logger.log(`Webhook notification sent to ${webhookUrl}`);
  }

  /**
   * Build email subject
   */
  private buildEmailSubject(incident: Incident, eventType: string): string {
    const prefix = incident.severity === IncidentSeverity.CRITICAL ? '🚨' : '⚠️';

    if (eventType === 'incident_detected') {
      return `${prefix} [${incident.severity}] Incident Detected: ${incident.title}`;
    } else if (eventType === 'incident_resolved') {
      return `✅ [RESOLVED] ${incident.title}`;
    } else if (eventType === 'remediation_executed') {
      return `⚙️ [REMEDIATION] Action executed for: ${incident.title}`;
    } else if (eventType === 'incident_escalated') {
      return `🔔 [ESCALATED] ${incident.title}`;
    }

    return `[${incident.severity}] ${incident.title}`;
  }

  /**
   * Build email body HTML
   */
  private buildEmailBody(
    incident: Incident,
    eventType: string,
    resolutionTime?: number,
    remediationAction?: RemediationAction,
    escalationReason?: string,
  ): string {
    const baseTemplate = `
      <html>
        <body style="font-family: Arial, sans-serif;">
          <h2>${incident.title}</h2>
          <p><strong>Description:</strong> ${incident.description}</p>
          <p><strong>Severity:</strong> ${incident.severity}</p>
          <p><strong>Status:</strong> ${incident.status}</p>
          <p><strong>Detected at:</strong> ${incident.detectedAt.toISOString()}</p>
    `;

    if (eventType === 'incident_resolved' && resolutionTime) {
      return `${
        baseTemplate
      }<p><strong>Resolution Time:</strong> ${(resolutionTime / 1000 / 60).toFixed(2)} minutes</p>
        </body></html>`;
    }

    if (remediationAction) {
      return `${
        baseTemplate
      }<p><strong>Remediation Action:</strong> ${remediationAction.actionType}</p>
        <p><strong>Status:</strong> ${remediationAction.status}</p>
        <p><strong>Output:</strong> ${remediationAction.executionOutput || 'N/A'}</p>
        </body></html>`;
    }

    if (escalationReason) {
      return `${baseTemplate}<p><strong>Escalation Reason:</strong> ${escalationReason}</p>
        </body></html>`;
    }

    return `${baseTemplate}</body></html>`;
  }

  /**
   * Build Slack message
   */
  private buildSlackMessage(
    incident: Incident,
    eventType: string,
    remediationAction?: RemediationAction,
  ): string {
    if (eventType === 'incident_detected') {
      return `🚨 New incident detected:\n*${incident.title}*\n${incident.description}`;
    } else if (eventType === 'incident_resolved') {
      return `✅ Incident resolved:\n*${incident.title}*`;
    } else if (eventType === 'remediation_executed' && remediationAction) {
      return `⚙️ Remediation action executed:\n*${remediationAction.actionType}*\nStatus: ${remediationAction.status}`;
    }

    return `Incident Update: ${incident.title}`;
  }

  /**
   * Register custom escalation policy
   */
  registerEscalationPolicy(name: string, policy: EscalationPolicy): void {
    this.escalationPolicies.set(name, policy);
    this.logger.log(`Escalation policy registered: ${name}`);
  }

  /**
   * Get escalation policy
   */
  getEscalationPolicy(name: string): EscalationPolicy | undefined {
    return this.escalationPolicies.get(name);
  }
}
