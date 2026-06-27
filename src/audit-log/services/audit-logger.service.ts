import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../audit-log.entity';
import { AuditAction, AuditSeverity, AuditCategory } from '../enums/audit-action.enum';
import { ConfigService } from '@nestjs/config';
import { sanitizePii } from '../../common/utils/pii-sanitizer.utils';
import {
  buildRetentionCutoff,
  buildRetentionUntil,
  resolveRetentionDays,
} from '../../middleware/audit/log-retention.policy';
import { IAuditLogEntry } from '../interfaces/audit-log.interfaces';
import { encryptString } from '../../common/utils/encryption.utils';

/**
 * Provides audit logging operations.
 * Responsible for creating and persisting audit log entries.
 * Single Responsibility: Writing audit logs to the database.
 */
@Injectable()
export class AuditLoggerService {
  private readonly logger = new Logger(AuditLoggerService.name);
  private readonly retentionDays: number;

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly configService: ConfigService,
  ) {
    this.retentionDays = resolveRetentionDays(
      this.configService.get<number>('AUDIT_LOG_RETENTION_DAYS', 365),
    );
  }

  /**
   * Log an audit event
   */
  async log(entry: IAuditLogEntry): Promise<AuditLog> {
    const retentionUntil = buildRetentionUntil(this.retentionDays);

    // Optionally encrypt metadata at rest when a key is provided
    const encryptionKey = this.configService.get<string>('DATA_ENCRYPTION_KEY');
    let metadata = entry.metadata;
    if (metadata && encryptionKey) {
      try {
        const plain = JSON.stringify(metadata);
        const encrypted = encryptString(plain, encryptionKey);
        metadata = { __encrypted: true, value: encrypted } as any;
      } catch (err) {
        this.logger.error('Failed to encrypt audit metadata', err as Error);
      }
    }

    const log = this.auditRepo.create({
      ...entry,
      metadata,
      severity: (entry.severity || AuditSeverity.INFO) as any,
      retentionUntil,
      httpMethod: entry.httpMethod as any,
    });

    try {
      const saved = await this.auditRepo.save(log);
      this.logger.debug(
        `Audit log created: ${log.action} - ${sanitizePii(log.description || 'no description')}`,
      );
      return saved;
    } catch (error) {
      this.logger.error('Failed to create audit log:', error);
      // Don't throw - audit logging should not break main functionality
      return log as any;
    }
  }

  /**
   * Log authentication event
   */
  async logAuth(
    action: AuditAction,
    userId: string | null,
    userEmail: string | null,
    ipAddress: string,
    userAgent: string,
    metadata?: Record<string, unknown>,
    severity: AuditSeverity = AuditSeverity.INFO,
  ): Promise<AuditLog> {
    return this.log({
      userId: userId || undefined,
      userEmail: userEmail || undefined,
      action,
      category: AuditCategory.AUTHENTICATION,
      severity,
      ipAddress,
      userAgent,
      metadata,
    });
  }

  /**
   * Log data modification
   */
  async logDataChange(
    action: AuditAction,
    userId: string,
    userEmail: string,
    entityType: string,
    entityId: string,
    oldValues: Record<string, unknown>,
    newValues: Record<string, unknown>,
    ipAddress?: string,
    description?: string,
  ): Promise<AuditLog> {
    return this.log({
      userId,
      userEmail,
      action,
      category: AuditCategory.DATA_MODIFICATION,
      severity: AuditSeverity.INFO,
      entityType,
      entityId,
      description,
      oldValues,
      newValues,
      ipAddress,
    });
  }

  /**
   * Log API access
   */
  async logApiAccess(
    userId: string | null,
    userEmail: string | null,
    apiEndpoint: string,
    httpMethod: string,
    statusCode: number,
    responseTimeMs: number,
    ipAddress: string,
    userAgent: string,
    requestId?: string,
  ): Promise<AuditLog> {
    const severity =
      statusCode >= 500
        ? AuditSeverity.ERROR
        : statusCode >= 400
          ? AuditSeverity.WARNING
          : AuditSeverity.INFO;

    return this.log({
      userId: userId || undefined,
      userEmail: userEmail || undefined,
      action: AuditAction.API_CALLED,
      category: AuditCategory.DATA_ACCESS,
      severity,
      apiEndpoint,
      httpMethod,
      statusCode,
      responseTimeMs,
      ipAddress,
      userAgent,
      requestId,
    });
  }

  /**
   * Log security event
   */
  async logSecurityEvent(
    action: AuditAction,
    userId: string | null,
    userEmail: string | null,
    ipAddress: string,
    userAgent: string,
    description: string,
    metadata?: Record<string, unknown>,
  ): Promise<AuditLog> {
    return this.log({
      userId: userId || undefined,
      userEmail: userEmail || undefined,
      action,
      category: AuditCategory.SECURITY,
      severity: AuditSeverity.WARNING,
      ipAddress,
      userAgent,
      description,
      metadata,
    });
  }

  /**
   * Apply retention policy - delete old logs
   */
  async applyRetentionPolicy(): Promise<number> {
    const cutoffDate = buildRetentionCutoff(this.retentionDays);

    const result = await this.auditRepo
      .createQueryBuilder()
      .delete()
      .where('timestamp < :cutoffDate', { cutoffDate })
      .orWhere('retentionUntil < NOW()')
      .execute();

    const deletedCount = result.affected || 0;
    this.logger.log(`Applied retention policy: deleted ${deletedCount} old audit logs`);
    return deletedCount;
  }
}
