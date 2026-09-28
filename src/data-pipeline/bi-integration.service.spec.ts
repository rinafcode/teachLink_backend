import { Test, TestingModule } from '@nestjs/testing';
import { BiIntegrationService } from './bi-integration.service';
import { DataWarehouseService } from './data-warehouse.service';
import { EtlRecord } from './etl.service';

const makeRecord = (source: string, id: string): EtlRecord => ({
  id,
  source,
  payload: { v: 1 },
  timestamp: new Date(),
});

describe('BiIntegrationService', () => {
  let service: BiIntegrationService;
  let warehouse: DataWarehouseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BiIntegrationService, DataWarehouseService],
    }).compile();
    service = module.get(BiIntegrationService);
    warehouse = module.get(DataWarehouseService);
  });

  describe('generateReport', () => {
    it('returns report with zero records when empty', () => {
      const report = service.generateReport();
      expect(report.totalRecords).toBe(0);
      expect(report.entries).toHaveLength(0);
      expect(report.generatedAt).toBeDefined();
    });

    it('includes ingested records', () => {
      warehouse.ingest(makeRecord('events', 'r1'));
      warehouse.ingest(makeRecord('events', 'r2'));
      const report = service.generateReport();
      expect(report.totalRecords).toBe(2);
      expect(report.bySource['events']).toBe(2);
    });

    it('filters by source', () => {
      warehouse.ingest(makeRecord('events', 'r1'));
      warehouse.ingest(makeRecord('metrics', 'r2'));
      const report = service.generateReport({ source: 'events' });
      expect(report.entries).toHaveLength(1);
    });
  });

  describe('export', () => {
    beforeEach(() => {
      warehouse.ingest(makeRecord('events', 'r1'));
    });

    it('exports JSON by default', () => {
      const result = service.export();
      expect(result.format).toBe('json');
      expect(() => JSON.parse(result.data)).not.toThrow();
    });

    it('exports CSV format', () => {
      const result = service.export({}, 'csv');
      expect(result.format).toBe('csv');
      expect(result.data).toContain(',');
    });

    it('exports empty CSV with default headers when no entries', () => {
      const emptyWarehouse = new DataWarehouseService();
      const emptyBi = new BiIntegrationService(emptyWarehouse);
      const result = emptyBi.export({}, 'csv');
      expect(result.format).toBe('csv');
      expect(result.data).toContain('id,source,storedAt');
    });
  });
});
