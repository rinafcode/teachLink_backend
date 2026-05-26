import { Injectable, Logger } from '@nestjs/common';
import { AuditLogService, IAuditLogEntry } from '../../audit-log/audit-log.service';
import { AuditAction, AuditCategory, AuditSeverity } from '../../audit-log/enums/audit-action.enum';
import { UserRole } from '../../users/entities/user.entity';

export interface MaskingAuditContext {
  viewerId: string;
  viewerEmail?: string;
  viewerRole: UserRole;
  targetEntityType: string;
  targetEntityId: string;
  maskedFields: string[];
  ipAddress?: string;
  requestId?: string;
}

@Injectable()
export class MaskingAuditService {
  private readonly logger = new Logger(MaskingAuditService.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  /**
   * Records a data access event with masking context.
   */
  async logMaskedAccess(ctx: MaskingAuditContext): Promise<void> {
    const entry: IAuditLogEntry = {
      userId: ctx.viewerId,
      userEmail: ctx.viewerEmail,
      action: AuditAction.DATA_VIEWED,
      category: AuditCategory.DATA_ACCESS,
      severity: AuditSeverity.INFO,
      entityType: ctx.targetEntityType,
      entityId: ctx.targetEntityId,
      description: `Data accessed with masking applied for role ${ctx.viewerRole}`,
      metadata: {
        viewerRole: ctx.viewerRole,
        maskedFields: ctx.maskedFields,
      },
      ipAddress: ctx.ipAddress,
      requestId: ctx.requestId,
    };

    try {
      await this.auditLogService.log(entry);
    } catch (err) {
      // Audit failures must not break the main flow
      this.logger.error('Failed to write masking audit log', err);
    }
  }
}
