import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SecurityService } from './security.service';
import { EncryptionService } from './encryption/encryption.service';
import { ThreatDetectionService } from './threats/threat-detection.service';
import { ComplianceService } from './compliance/compliance.service';
import { AuditLoggingService } from './audit/audit-logging.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    SecurityService,
    EncryptionService,
    ThreatDetectionService,
    ComplianceService,
    AuditLoggingService,
  ],
  exports: [SecurityService, EncryptionService],
})
export class SecurityModule {}
