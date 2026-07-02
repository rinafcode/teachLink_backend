import { registerAs } from '@nestjs/config';

export const retentionConfig = registerAs('retention', () => ({
  /**
   * Retention period for soft-deleted records in days.
   * Records soft-deleted longer than this will be purged/archived.
   */
  softDeleteRetentionDays: parseInt(process.env.RETENTION_SOFT_DELETE_DAYS || '30', 10),

  /**
   * Retention period for audit logs in days.
   */
  auditLogRetentionDays: parseInt(process.env.RETENTION_AUDIT_LOG_DAYS || '90', 10),

  /**
   * Retention period for notifications in days.
   */
  notificationRetentionDays: parseInt(process.env.RETENTION_NOTIFICATION_DAYS || '30', 10),

  /**
   * Retention period for analytics events in days.
   */
  analyticsRetentionDays: parseInt(process.env.ANALYTICS_RETENTION_DAYS || '365', 10),

  /**
   * Whether to archive data before purging.
   */
  enableArchiving: process.env.RETENTION_ENABLE_ARCHIVING !== 'false',

  /**
   * Max records to process per purge batch to avoid memory issues/DB locks.
   */
  batchSize: parseInt(process.env.RETENTION_BATCH_SIZE || '1000', 10),
}));
