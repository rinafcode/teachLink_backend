import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SecurityService } from './security.service';
import { EncryptionService } from './encryption/encryption.service';
import { ThreatDetectionService } from './threats/threat-detection.service';
import { ComplianceService } from './compliance/compliance.service';
import { AuditLoggingService } from './audit/audit-logging.service';
import { SecretsModule } from './secrets/secrets.module';
import { SecurityEventLogger } from './audit/security-event-logger';
import { RedisModule } from '../common/redis/redis.module';
import { REDIS_CLIENT } from '../common/redis/redis.constants';
import { THREAT_REDIS_CLIENT } from './threats/threat-detection.constants';
import { RequestSigningService } from './request-signing.service';
import { ServiceAuthService } from './service-auth.service';
import { ZeroTrustGuard } from './zero-trust.guard';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { StructuredLoggerService } from '../observability/logging/structured-logger.service';

/**
 * SecurityModule wires the zero-trust architecture:
 *
 *   - ZeroTrustGuard:    identity verification on every inbound request
 *   - ServiceAuthService: HMAC service-to-service authentication
 *   - EncryptionService:  AES-256-GCM encryption in transit and at rest
 *   - AuditLoggingService: structured audit trail for all security events
 *   - ThreatDetectionService: IP-level abuse detection
 *
 * Issue #798: wires the shared Redis client behind `THREAT_REDIS_CLIENT`
 * so ThreatDetectionService uses a distributed store instead of an
 * in-process Map. The token keeps the dependency mockable in unit tests.
 *
 * Issue #837: `THREAT_REDIS_CLIENT` is now aliased to the shared
 * `REDIS_CLIENT` connection (standalone/Sentinel/Cluster, see
 * `RedisModule`) instead of opening its own connection.
 */
@Module({
  imports: [ScheduleModule.forRoot(), SecretsModule, MonitoringModule, RedisModule.forRoot()],
  providers: [
    SecurityService,
    EncryptionService,
    { provide: THREAT_REDIS_CLIENT, useExisting: REDIS_CLIENT },
    ThreatDetectionService,
    ComplianceService,
    AuditLoggingService,
    StructuredLoggerService,
    SecurityEventLogger,
    RequestSigningService,
    ServiceAuthService,
    ZeroTrustGuard,
  ],
  exports: [
    SecurityService,
    EncryptionService,
    SecretsModule,
    THREAT_REDIS_CLIENT,
    SecurityEventLogger,
    RequestSigningService,
    ServiceAuthService,
    ZeroTrustGuard,
    AuditLoggingService,
  ],
})
export class SecurityModule {}
