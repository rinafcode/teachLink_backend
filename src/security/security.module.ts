import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SecurityService } from './security.service';
import { EncryptionService } from './encryption/encryption.service';
import { ThreatDetectionService } from './threats/threat-detection.service';
import { ComplianceService } from './compliance/compliance.service';
import { AuditLoggingService } from './audit/audit-logging.service';
import { SecretsModule } from './secrets/secrets.module';
import { ServiceAuthService } from './service-auth.service';
import { ZeroTrustGuard } from './zero-trust.guard';

/**
 * SecurityModule wires the zero-trust architecture:
 *
 *   - ZeroTrustGuard:    identity verification on every inbound request
 *   - ServiceAuthService: HMAC service-to-service authentication
 *   - EncryptionService:  AES-256-GCM encryption in transit and at rest
 *   - AuditLoggingService: structured audit trail for all security events
 *   - ThreatDetectionService: IP-level abuse detection
 */
@Module({
  imports: [ScheduleModule.forRoot(), SecretsModule],
  providers: [
    SecurityService,
    EncryptionService,
    ThreatDetectionService,
    ComplianceService,
    AuditLoggingService,
    ServiceAuthService,
    ZeroTrustGuard,
  ],
  exports: [
    SecurityService,
    EncryptionService,
    SecretsModule,
    ServiceAuthService,
    ZeroTrustGuard,
    AuditLoggingService,
  ],
})
export class SecurityModule {}
