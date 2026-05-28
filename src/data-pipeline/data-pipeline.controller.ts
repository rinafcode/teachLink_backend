import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { EtlService, EtlResult } from './etl.service';
import { DataWarehouseService, WarehouseEntry } from './data-warehouse.service';
import { BiIntegrationService, BiReport, BiExportFormat } from './bi-integration.service';

class RunEtlDto {
  source: string;
  data: Record<string, unknown>[];
}

@Controller('data-pipeline')
export class DataPipelineController {
  constructor(
    private readonly etl: EtlService,
    private readonly warehouse: DataWarehouseService,
    private readonly bi: BiIntegrationService,
  ) {}

  @Post('etl/run')
  async runEtl(@Body() body: RunEtlDto): Promise<EtlResult> {
    return this.etl.run(body.source, body.data);
  }

  @Get('warehouse')
  queryWarehouse(
    @Query('source') source?: string,
    @Query('limit') limit?: string,
  ): WarehouseEntry[] {
    return this.warehouse.query({ source, limit: limit ? parseInt(limit, 10) : 100 });
  }

  @Get('warehouse/aggregate')
  aggregate(@Query('source') source?: string): Record<string, number> {
    return this.warehouse.aggregate(source);
  }

  @Get('bi/report')
  getReport(@Query('source') source?: string): BiReport {
    return this.bi.generateReport({ source });
  }

  @Get('bi/export')
  exportData(
    @Query('source') source?: string,
    @Query('format') format?: 'json' | 'csv',
  ): BiExportFormat {
    return this.bi.export({ source }, format ?? 'json');
  }
}
