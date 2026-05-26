import { SetMetadata } from '@nestjs/common';
import { AuditAction } from '../enums/audit-action.enum';

export const SENSITIVE_OPERATION_KEY = 'sensitive_operation';

export interface ISensitiveOperationOptions {
  action: AuditAction;
  entityType: string;
  entityIdParam?: string;
  description?: string;
  logOldValues?: boolean;
  logNewValues?: boolean;
}

/**
 * Decorator to mark a method as a sensitive operation
 * Ensures elevated audit logging with WARNING or CRITICAL severity
 */
export const SensitiveOperation = (options: ISensitiveOperationOptions) =>
  SetMetadata(SENSITIVE_OPERATION_KEY, options);

/**
 * Predefined decorators for common sensitive operations
 */
export const SensitiveUserDeletion = (options?: Partial<ISensitiveOperationOptions>) =>
  SensitiveOperation({
    action: AuditAction.USER_DELETED,
    entityType: 'User',
    description: 'User deletion - critical operation',
    logOldValues: true,
    ...options,
  });

export const SensitiveRoleChange = (options?: Partial<ISensitiveOperationOptions>) =>
  SensitiveOperation({
    action: AuditAction.USER_ROLE_CHANGED,
    entityType: 'User',
    description: 'User role change - security sensitive',
    logOldValues: true,
    logNewValues: true,
    ...options,
  });

export const SensitivePasswordChange = (options?: Partial<ISensitiveOperationOptions>) =>
  SensitiveOperation({
    action: AuditAction.PASSWORD_CHANGE,
    entityType: 'User',
    description: 'Password change - security sensitive',
    ...options,
  });

export const SensitiveConfigChange = (options?: Partial<ISensitiveOperationOptions>) =>
  SensitiveOperation({
    action: AuditAction.CONFIG_CHANGED,
    entityType: 'Configuration',
    description: 'Configuration change - system critical',
    logOldValues: true,
    logNewValues: true,
    ...options,
  });

export const SensitiveDataExport = (options?: Partial<ISensitiveOperationOptions>) =>
  SensitiveOperation({
    action: AuditAction.DATA_EXPORTED,
    entityType: 'Data',
    description: 'Data export - compliance sensitive',
    ...options,
  });

export const SensitiveBackupOperation = (options?: Partial<ISensitiveOperationOptions>) =>
  SensitiveOperation({
    action: AuditAction.BACKUP_CREATED,
    entityType: 'Backup',
    description: 'Backup operation - system critical',
    ...options,
  });
