import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './audit-log.entity';
import { AuditLogService } from './audit-log.service';
import { AuditLoggerService } from './services/audit-logger.service';
import { AuditQueryService } from './services/audit-query.service';
import { AuditReportingService } from './services/audit-reporting.service';
import { AuditExportService } from './services/audit-export.service';
import { AuditRetentionTask } from './tasks/audit-retention.task';
import { MetricsCollectionService } from '../monitoring/metrics/metrics-collection.service';

/**
 * Audit Log Module
 * Provides audit logging, querying, reporting, and export functionality.
 * Uses Single Responsibility Principle with specialized services:
 * - AuditLoggerService: Handles creating audit logs
 * - AuditQueryService: Handles searching and retrieving audit logs
 * - AuditReportingService: Handles report generation and statistics
 * - AuditExportService: Handles exporting logs to various formats
 */
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [
    AuditLoggerService,
    AuditQueryService,
    AuditReportingService,
    AuditExportService,
    AuditRetentionTask,
    AuditLogService,
    MetricsCollectionService,
  ],
  exports: [AuditLogService],
})
export class AuditLogModule {}
