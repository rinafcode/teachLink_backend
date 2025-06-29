import { Module } from '@nestjs/common';

import { AuditLoggingService } from './audit/audit-logging.service';
import { SecurityService } from './security.service';
import { EncryptionService } from './encryption/encryption.service';
import { ThreatDetectionService } from './threats/threat-detection.service';
import { ComplianceService } from './compliance/compliance.service';

@Module({
  providers: [
    SecurityService,
    EncryptionService,
    ThreatDetectionService,
    ComplianceService,
    AuditLoggingService,
  ],
  exports: [
    SecurityService,
    EncryptionService,
    ThreatDetectionService,
    ComplianceService,
    AuditLoggingService,
  ],
})
export class SecurityModule {}
