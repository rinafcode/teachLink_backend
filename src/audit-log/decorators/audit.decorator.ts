import { SetMetadata } from '@nestjs/common';
import { AuditAction, AuditCategory, AuditSeverity } from '../enums/audit-action.enum';

export const AUDIT_LOG_KEY = 'audit_log';

export interface IAuditLogOptions {
  action: AuditAction;
  category?: AuditCategory;
  severity?: AuditSeverity;
  entityType?: string;
  entityIdParam?: string;
  description?: string;
  logRequestBody?: boolean;
  logResponseBody?: boolean;
  sensitiveFields?: string[];
}

/**
 * Decorator to mark a method for audit logging
 * @param options Audit log configuration options
 */
export const AuditLog = (options: IAuditLogOptions) => SetMetadata(AUDIT_LOG_KEY, options);

/**
 * Predefined audit log decorators for common operations
 */
export const AuditCreate = (entityType: string, options?: Partial<IAuditLogOptions>) =>
  AuditLog({
    action: AuditAction.DATA_CREATED,
    category: AuditCategory.DATA_MODIFICATION,
    entityType,
    ...options,
  });

export const AuditUpdate = (
  entityType: string,
  entityIdParam: string,
  options?: Partial<IAuditLogOptions>,
) =>
  AuditLog({
    action: AuditAction.DATA_UPDATED,
    category: AuditCategory.DATA_MODIFICATION,
    entityType,
    entityIdParam,
    ...options,
  });

export const AuditDelete = (
  entityType: string,
  entityIdParam: string,
  options?: Partial<IAuditLogOptions>,
) =>
  AuditLog({
    action: AuditAction.DATA_DELETED,
    category: AuditCategory.DATA_MODIFICATION,
    severity: AuditSeverity.WARNING,
    entityType,
    entityIdParam,
    ...options,
  });

export const AuditView = (
  entityType: string,
  entityIdParam?: string,
  options?: Partial<IAuditLogOptions>,
) =>
  AuditLog({
    action: AuditAction.DATA_VIEWED,
    category: AuditCategory.DATA_ACCESS,
    entityType,
    entityIdParam,
    ...options,
  });

export const AuditExport = (entityType: string, options?: Partial<IAuditLogOptions>) =>
  AuditLog({
    action: AuditAction.DATA_EXPORTED,
    category: AuditCategory.DATA_ACCESS,
    severity: AuditSeverity.WARNING,
    entityType,
    ...options,
  });

export const AuditLogin = (options?: Partial<IAuditLogOptions>) =>
  AuditLog({
    action: AuditAction.LOGIN,
    category: AuditCategory.AUTHENTICATION,
    ...options,
  });

export const AuditLogout = (options?: Partial<IAuditLogOptions>) =>
  AuditLog({
    action: AuditAction.LOGOUT,
    category: AuditCategory.AUTHENTICATION,
    ...options,
  });
