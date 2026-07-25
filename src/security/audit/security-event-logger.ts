import { Injectable } from '@nestjs/common';
import { MetricsCollectionService } from '../../monitoring/metrics/metrics-collection.service';
import { StructuredLoggerService } from '../../observability/logging/structured-logger.service';

export enum SecurityEventType {
  AUTH_FAILURE = 'AUTH_FAILURE',
  TOKEN_REUSE = 'TOKEN_REUSE',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  PRIVILEGE_ESCALATION = 'PRIVILEGE_ESCALATION',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
}

export type SecurityEventSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SecurityEvent {
  eventType: SecurityEventType;
  userId?: string | null;
  ip?: string | null;
  timestamp?: string;
  severity: SecurityEventSeverity;
  details: Record<string, unknown>;
}

@Injectable()
export class SecurityEventLogger {
  constructor(
    private readonly logger: StructuredLoggerService,
    private readonly metrics: MetricsCollectionService,
  ) {}

  emit(event: SecurityEvent): void {
    const securityEvent = {
      eventType: event.eventType,
      userId: event.userId ?? null,
      ip: event.ip ?? 'unknown',
      timestamp: event.timestamp ?? new Date().toISOString(),
      severity: event.severity,
      details: event.details,
    };

    this.logger.warn('security.event', {
      stream: 'security',
      ...securityEvent,
    });
    this.metrics.recordSecurityEvent(event.eventType);
  }
}
