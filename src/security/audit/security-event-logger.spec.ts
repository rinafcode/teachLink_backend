import { MetricsCollectionService } from '../../monitoring/metrics/metrics-collection.service';
import { StructuredLoggerService } from '../../observability/logging/structured-logger.service';
import { SecurityEventLogger, SecurityEventType } from './security-event-logger';

describe('SecurityEventLogger', () => {
  it('emits structured security events and increments the Prometheus counter', async () => {
    const structuredLogger = {
      warn: jest.fn(),
    } as unknown as StructuredLoggerService;
    const metrics = new MetricsCollectionService();
    const logger = new SecurityEventLogger(structuredLogger, metrics);

    logger.emit({
      eventType: SecurityEventType.AUTH_FAILURE,
      userId: 'user-1',
      ip: '203.0.113.10',
      severity: 'medium',
      details: {
        reason: 'invalid_password',
        action: 'login',
      },
    });

    expect(structuredLogger.warn).toHaveBeenCalledWith(
      'security.event',
      expect.objectContaining({
        stream: 'security',
        eventType: SecurityEventType.AUTH_FAILURE,
        userId: 'user-1',
        ip: '203.0.113.10',
        severity: 'medium',
        timestamp: expect.any(String),
        details: {
          reason: 'invalid_password',
          action: 'login',
        },
      }),
    );

    const [, payload] = (structuredLogger.warn as jest.Mock).mock.calls[0];
    expect(() => JSON.stringify(payload)).not.toThrow();
    expect(new Date(payload.timestamp).toString()).not.toBe('Invalid Date');

    await expect(metrics.getMetrics()).resolves.toContain(
      'security_events_total{type="AUTH_FAILURE"} 1',
    );
  });
});
