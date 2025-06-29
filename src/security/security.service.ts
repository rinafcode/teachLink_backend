import { Injectable } from '@nestjs/common';
import { AuditLoggingService } from './audit/audit-logging.service';
import { ComplianceService } from './compliance/compliance.service';
import { EncryptionService } from './encryption/encryption.service';
import { ThreatDetectionService } from './threats/threat-detection.service';

@Injectable()
export class SecurityService {
  constructor(
    private readonly encryptionService: EncryptionService,
    private readonly threatDetectionService: ThreatDetectionService,
    private readonly complianceService: ComplianceService,
    private readonly auditLoggingService: AuditLoggingService,
  ) {}

  encryptData(data: string): string {
    return this.encryptionService.encrypt(data);
  }

  decryptData(data: string): string {
    return this.encryptionService.decrypt(data);
  }

  logEvent(event: string, details: any) {
    this.auditLoggingService.log(event, details);
  }

  async checkThreat(payload: any): Promise<boolean> {
    return this.threatDetectionService.isThreat(payload);
  }

  async handleDataRequest(userId: string) {
    return this.complianceService.exportUserData(userId);
  }

  async deleteUserData(userId: string) {
    return this.complianceService.deleteUserData(userId);
  }
}
