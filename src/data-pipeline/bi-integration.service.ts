import { Injectable, Logger } from '@nestjs/common';
import { DataWarehouseService, WarehouseQueryOptions } from './data-warehouse.service';

export interface BiReport {
  generatedAt: string;
  totalRecords: number;
  bySource: Record<string, number>;
  entries: unknown[];
}

export interface BiExportFormat {
  format: 'json' | 'csv';
  data: string;
}

@Injectable()
export class BiIntegrationService {
  private readonly logger = new Logger(BiIntegrationService.name);

  constructor(private readonly warehouse: DataWarehouseService) {}

  generateReport(options: WarehouseQueryOptions = {}): BiReport {
    const entries = this.warehouse.query(options);
    const bySource = this.warehouse.aggregate(options.source);

    const report: BiReport = {
      generatedAt: new Date().toISOString(),
      totalRecords: this.warehouse.count(),
      bySource,
      entries,
    };

    this.logger.log(`BI report generated: total=${report.totalRecords}`);
    return report;
  }

  export(options: WarehouseQueryOptions = {}, format: 'json' | 'csv' = 'json'): BiExportFormat {
    const entries = this.warehouse.query(options);

    if (format === 'csv') {
      const headers =
        entries.length > 0 ? Object.keys(entries[0] as object).join(',') : 'id,source,storedAt';
      const rows = entries.map((e) => Object.values(e as object).join(','));
      return { format: 'csv', data: [headers, ...rows].join('\n') };
    }

    return { format: 'json', data: JSON.stringify(entries, null, 2) };
  }
}
