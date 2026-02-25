import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AlertingService {
  private readonly logger = new Logger(AlertingService.name);

  sendAlert(type: string, message: string, severity: 'INFO' | 'WARNING' | 'CRITICAL') {
    this.logger.warn(`[ALERT][${severity}] ${type}: ${message}`);
    // Here you would integrate with external services like Slack, Email, or PagerDuty
  }
}
