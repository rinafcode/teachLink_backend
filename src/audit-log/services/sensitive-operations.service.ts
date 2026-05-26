import { Injectable, Logger } from '@nestjs/common';
import { AuditLogService, IAuditLogEntry } from '../audit-log.service';
import { AuditAction, AuditSeverity, AuditCategory } from '../enums/audit-action.enum';

export interface ISensitiveOperation {
  userId: string;
  userEmail: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  description: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class SensitiveOperationsService {
  private readonly logger = new Logger(SensitiveOperationsService.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  /**
   * Log a sensitive operation with elevated severity
   */
  async logSensitiveOperation(operation: ISensitiveOperation): Promise<void> {
    try {
      const entry: IAuditLogEntry = {
        userId: operation.userId,
        userEmail: operation.userEmail,
        action: operation.action,
        category: this.resolveCategoryForAction(operation.action),
        severity: AuditSeverity.WARNING,
        entityType: operation.entityType,
        entityId: operation.entityId,
        description: operation.description,
        oldValues: operation.oldValues,
        newValues: operation.newValues,
        ipAddress: operation.ipAddress,
        userAgent: operation.userAgent,
        requestId: operation.requestId,
        metadata: {
          ...operation.metadata,
          isSensitiveOperation: true,
          timestamp: new Date().toISOString(),
        },
      };

      await this.auditLogService.log(entry);
      this.logger.log(
        `Sensitive operation logged: ${operation.action} on ${operation.entityType}/${operation.entityId}`,
      );
    } catch (error) {
      this.logger.error('Failed to log sensitive operation:', error);
      throw error;
    }
  }

  /**
   * Log user deletion (critical operation)
   */
  async logUserDeletion(
    userId: string,
    userEmail: string,
    targetUserId: string,
    targetUserEmail: string,
    ipAddress: string,
    userAgent: string,
    requestId?: string,
  ): Promise<void> {
    await this.logSensitiveOperation({
      userId,
      userEmail,
      action: AuditAction.USER_DELETED,
      entityType: 'User',
      entityId: targetUserId,
      description: `User ${targetUserEmail} deleted by ${userEmail}`,
      ipAddress,
      userAgent,
      requestId,
      metadata: {
        targetUserEmail,
        performedBy: userEmail,
      },
    });
  }

  /**
   * Log role changes (security-sensitive)
   */
  async logRoleChange(
    userId: string,
    userEmail: string,
    targetUserId: string,
    targetUserEmail: string,
    oldRole: string,
    newRole: string,
    ipAddress: string,
    userAgent: string,
    requestId?: string,
  ): Promise<void> {
    await this.logSensitiveOperation({
      userId,
      userEmail,
      action: AuditAction.USER_ROLE_CHANGED,
      entityType: 'User',
      entityId: targetUserId,
      description: `User role changed from ${oldRole} to ${newRole}`,
      oldValues: { role: oldRole },
      newValues: { role: newRole },
      ipAddress,
      userAgent,
      requestId,
      metadata: {
        targetUserEmail,
        performedBy: userEmail,
        oldRole,
        newRole,
      },
    });
  }

  /**
   * Log password changes (security-sensitive)
   */
  async logPasswordChange(
    userId: string,
    userEmail: string,
    ipAddress: string,
    userAgent: string,
    requestId?: string,
  ): Promise<void> {
    await this.logSensitiveOperation({
      userId,
      userEmail,
      action: AuditAction.PASSWORD_CHANGE,
      entityType: 'User',
      entityId: userId,
      description: `Password changed for user ${userEmail}`,
      ipAddress,
      userAgent,
      requestId,
      metadata: {
        performedBy: userEmail,
      },
    });
  }

  /**
   * Log configuration changes (system-sensitive)
   */
  async logConfigChange(
    userId: string,
    userEmail: string,
    configKey: string,
    oldValue: unknown,
    newValue: unknown,
    ipAddress: string,
    userAgent: string,
    requestId?: string,
  ): Promise<void> {
    await this.auditLogService.log({
      userId,
      userEmail,
      action: AuditAction.CONFIG_CHANGED,
      category: AuditCategory.SYSTEM,
      severity: AuditSeverity.CRITICAL,
      entityType: 'Configuration',
      entityId: configKey,
      description: `Configuration changed: ${configKey}`,
      oldValues: { value: oldValue },
      newValues: { value: newValue },
      ipAddress,
      userAgent,
      requestId,
      metadata: {
        configKey,
        performedBy: userEmail,
      },
    });
  }

  /**
   * Log data export (compliance-sensitive)
   */
  async logDataExport(
    userId: string,
    userEmail: string,
    entityType: string,
    recordCount: number,
    exportFormat: string,
    ipAddress: string,
    userAgent: string,
    requestId?: string,
  ): Promise<void> {
    await this.logSensitiveOperation({
      userId,
      userEmail,
      action: AuditAction.DATA_EXPORTED,
      entityType,
      entityId: `export-${Date.now()}`,
      description: `${recordCount} ${entityType} records exported as ${exportFormat}`,
      ipAddress,
      userAgent,
      requestId,
      metadata: {
        recordCount,
        exportFormat,
        performedBy: userEmail,
      },
    });
  }

  /**
   * Log backup operations (critical)
   */
  async logBackupOperation(
    userId: string,
    userEmail: string,
    backupType: 'CREATE' | 'RESTORE',
    backupId: string,
    ipAddress: string,
    userAgent: string,
    requestId?: string,
  ): Promise<void> {
    const action =
      backupType === 'CREATE' ? AuditAction.BACKUP_CREATED : AuditAction.BACKUP_RESTORED;
    const description = `Backup ${backupType.toLowerCase()} operation: ${backupId}`;

    await this.auditLogService.log({
      userId,
      userEmail,
      action,
      category: AuditCategory.SYSTEM,
      severity: AuditSeverity.CRITICAL,
      entityType: 'Backup',
      entityId: backupId,
      description,
      ipAddress,
      userAgent,
      requestId,
      metadata: {
        backupType,
        performedBy: userEmail,
      },
    });
  }

  /**
   * Log permission denied events (security)
   */
  async logPermissionDenied(
    userId: string | null,
    userEmail: string | null,
    resource: string,
    action: string,
    ipAddress: string,
    userAgent: string,
    requestId?: string,
  ): Promise<void> {
    await this.auditLogService.log({
      userId: userId || undefined,
      userEmail: userEmail || undefined,
      action: AuditAction.PERMISSION_DENIED,
      category: AuditCategory.SECURITY,
      severity: AuditSeverity.WARNING,
      entityType: resource,
      description: `Permission denied for action: ${action} on ${resource}`,
      ipAddress,
      userAgent,
      requestId,
      metadata: {
        resource,
        attemptedAction: action,
      },
    });
  }

  /**
   * Log suspicious activity (security)
   */
  async logSuspiciousActivity(
    userId: string | null,
    userEmail: string | null,
    activityType: string,
    description: string,
    ipAddress: string,
    userAgent: string,
    requestId?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.auditLogService.log({
      userId: userId || undefined,
      userEmail: userEmail || undefined,
      action: AuditAction.SUSPICIOUS_ACTIVITY,
      category: AuditCategory.SECURITY,
      severity: AuditSeverity.CRITICAL,
      description,
      ipAddress,
      userAgent,
      requestId,
      metadata: {
        activityType,
        ...metadata,
      },
    });
  }

  private resolveCategoryForAction(action: AuditAction): AuditCategory {
    const categoryMap: Record<AuditAction, AuditCategory> = {
      [AuditAction.LOGIN]: AuditCategory.AUTHENTICATION,
      [AuditAction.LOGIN_FAILED]: AuditCategory.AUTHENTICATION,
      [AuditAction.LOGOUT]: AuditCategory.AUTHENTICATION,
      [AuditAction.REGISTER]: AuditCategory.AUTHENTICATION,
      [AuditAction.PASSWORD_RESET_REQUEST]: AuditCategory.AUTHENTICATION,
      [AuditAction.PASSWORD_RESET]: AuditCategory.AUTHENTICATION,
      [AuditAction.PASSWORD_CHANGE]: AuditCategory.AUTHENTICATION,
      [AuditAction.EMAIL_VERIFIED]: AuditCategory.AUTHENTICATION,
      [AuditAction.TOKEN_REFRESH]: AuditCategory.AUTHENTICATION,
      [AuditAction.SESSION_EXPIRED]: AuditCategory.AUTHENTICATION,
      [AuditAction.SESSION_REVOKED]: AuditCategory.AUTHENTICATION,
      [AuditAction.USER_CREATED]: AuditCategory.AUTHORIZATION,
      [AuditAction.USER_UPDATED]: AuditCategory.AUTHORIZATION,
      [AuditAction.USER_DELETED]: AuditCategory.AUTHORIZATION,
      [AuditAction.USER_ROLE_CHANGED]: AuditCategory.AUTHORIZATION,
      [AuditAction.USER_STATUS_CHANGED]: AuditCategory.AUTHORIZATION,
      [AuditAction.DATA_VIEWED]: AuditCategory.DATA_ACCESS,
      [AuditAction.DATA_CREATED]: AuditCategory.DATA_MODIFICATION,
      [AuditAction.DATA_UPDATED]: AuditCategory.DATA_MODIFICATION,
      [AuditAction.DATA_DELETED]: AuditCategory.DATA_MODIFICATION,
      [AuditAction.DATA_EXPORTED]: AuditCategory.DATA_ACCESS,
      [AuditAction.DATA_IMPORTED]: AuditCategory.DATA_MODIFICATION,
      [AuditAction.FILE_UPLOADED]: AuditCategory.FILE_OPERATION,
      [AuditAction.FILE_DOWNLOADED]: AuditCategory.FILE_OPERATION,
      [AuditAction.FILE_DELETED]: AuditCategory.FILE_OPERATION,
      [AuditAction.FILE_SHARED]: AuditCategory.FILE_OPERATION,
      [AuditAction.API_CALLED]: AuditCategory.DATA_ACCESS,
      [AuditAction.API_RATE_LIMITED]: AuditCategory.SECURITY,
      [AuditAction.API_ERROR]: AuditCategory.SYSTEM,
      [AuditAction.PERMISSION_DENIED]: AuditCategory.SECURITY,
      [AuditAction.SUSPICIOUS_ACTIVITY]: AuditCategory.SECURITY,
      [AuditAction.MFA_ENABLED]: AuditCategory.SECURITY,
      [AuditAction.MFA_DISABLED]: AuditCategory.SECURITY,
      [AuditAction.MFA_FAILED]: AuditCategory.SECURITY,
      [AuditAction.CONFIG_CHANGED]: AuditCategory.SYSTEM,
      [AuditAction.SETTING_UPDATED]: AuditCategory.SYSTEM,
      [AuditAction.BACKUP_CREATED]: AuditCategory.SYSTEM,
      [AuditAction.BACKUP_RESTORED]: AuditCategory.SYSTEM,
      [AuditAction.DATA_RETENTION_APPLIED]: AuditCategory.COMPLIANCE,
      [AuditAction.AUDIT_LOG_EXPORTED]: AuditCategory.COMPLIANCE,
      [AuditAction.REPORT_GENERATED]: AuditCategory.COMPLIANCE,
    };

    return categoryMap[action] || AuditCategory.SYSTEM;
  }
}
