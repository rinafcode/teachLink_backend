import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { FeatureFlagAuditController } from './feature-flag-audit.controller';
import { FeatureFlagAuditService } from './feature-flag-audit.service';

/**
 * Provides runtime feature flag management with a full audit trail.
 *
 * Exports {@link FeatureFlagAuditService} so other modules can read and
 * toggle flags programmatically while keeping the audit log up to date.
 */
@Module({
  imports: [AuditLogModule],
  controllers: [FeatureFlagAuditController],
  providers: [FeatureFlagAuditService],
  exports: [FeatureFlagAuditService],
})
export class FeatureFlagAuditModule {}
