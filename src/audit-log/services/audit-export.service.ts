import { Injectable } from '@nestjs/common';
import { AuditQueryService } from './audit-query.service';
import { IAuditLogSearchFilters } from '../interfaces/audit-log.interfaces';

/**
 * Provides audit log export operations.
 * Responsible for exporting audit logs in various formats.
 * Single Responsibility: Formatting and exporting audit logs.
 */
@Injectable()
export class AuditExportService {
  constructor(private readonly queryService: AuditQueryService) {}

  /**
   * Export logs to JSON format
   */
  async exportToJson(filters: IAuditLogSearchFilters): Promise<string> {
    const { data } = await this.queryService.search(filters, 1, 10000);
    return JSON.stringify(data, null, 2);
  }

  /**
   * Export logs to CSV format
   */
  async exportToCsv(filters: IAuditLogSearchFilters): Promise<string> {
    const { data } = await this.queryService.search(filters, 1, 10000);

    const headers = [
      'timestamp',
      'userId',
      'userEmail',
      'action',
      'category',
      'severity',
      'entityType',
      'entityId',
      'description',
      'ipAddress',
      'userAgent',
      'apiEndpoint',
      'httpMethod',
      'statusCode',
    ];

    const rows = data.map((log) => [
      log.timestamp.toISOString(),
      log.userId || '',
      log.userEmail || '',
      log.action,
      log.category,
      log.severity,
      log.entityType || '',
      log.entityId || '',
      log.description || '',
      log.ipAddress || '',
      log.userAgent || '',
      log.apiEndpoint || '',
      log.httpMethod || '',
      log.statusCode || '',
    ]);

    const escapeCsv = (value: string | number) => {
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [headers.join(','), ...rows.map((row) => row.map(escapeCsv).join(','))].join(
      '\n',
    );

    return csvContent;
  }
}
