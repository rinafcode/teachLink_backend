import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { SecurityService } from './security.service';
import { EncryptionService } from './encryption/encryption.service';
import { ThreatDetectionService } from './threats/threat-detection.service';
import { THREAT_REDIS_CLIENT } from './threats/threat-detection.constants';
import { ComplianceService } from './compliance/compliance.service';
import { AuditLoggingService } from './audit/audit-logging.service';
import { SecretsModule } from './secrets/secrets.module';
import { SecurityEventLogger } from './audit/security-event-logger';
import { getSharedRedisClient } from '../config/cache.config';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { StructuredLoggerService } from '../observability/logging/structured-logger.service';

/**
 * Registers the security module.
 *
 * Issue #798: wires the shared Redis client behind `THREAT_REDIS_CLIENT`
 * so ThreatDetectionService uses a distributed store instead of an
 * in-process Map. The token keeps the dependency mockable in unit tests.
 */
@Module({
  imports: [ScheduleModule.forRoot(), SecretsModule, MonitoringModule],
  providers: [
    SecurityService,
    EncryptionService,
    {
      provide: THREAT_REDIS_CLIENT,
      useFactory: (configService: ConfigService) => getSharedRedisClient(configService),
      inject: [ConfigService],
    },
    ThreatDetectionService,
    ComplianceService,
    AuditLoggingService,
    StructuredLoggerService,
    SecurityEventLogger,
  ],
  exports: [
    SecurityService,
    EncryptionService,
    SecretsModule,
    THREAT_REDIS_CLIENT,
    SecurityEventLogger,
  ],
})
export class SecurityModule {}
