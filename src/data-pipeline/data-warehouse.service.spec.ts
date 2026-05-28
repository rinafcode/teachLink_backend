import { Test, TestingModule } from '@nestjs/testing';
import { DataWarehouseService } from './data-warehouse.service';
import { EtlRecord } from './etl.service';

const makeRecord = (source: string, id = '1'): EtlRecord => ({
  id,
  source,
  payload: { value: 42 },
  timestamp: new Date(),
});

describe('DataWarehouseService', () => {
  let service: DataWarehouseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DataWarehouseService],
    }).compile();
    service = module.get(DataWarehouseService);
  });

  it('starts empty', () => {
    expect(service.count()).toBe(0);
  });

  describe('ingest', () => {
    it('stores a record', () => {
      service.ingest(makeRecord('events', 'r1'));
      expect(service.count()).toBe(1);
    });
  });

  describe('handleEtlRecord', () => {
    it('ingests via event handler', () => {
      service.handleEtlRecord(makeRecord('events', 'r2'));
      expect(service.count()).toBe(1);
    });
  });

  describe('query', () => {
    beforeEach(() => {
      service.ingest(makeRecord('events', 'a'));
      service.ingest(makeRecord('metrics', 'b'));
      service.ingest(makeRecord('events', 'c'));
    });

    it('returns all entries without filter', () => {
      expect(service.query()).toHaveLength(3);
    });

    it('filters by source', () => {
      const results = service.query({ source: 'events' });
      expect(results).toHaveLength(2);
      expect(results.every((e) => e.source === 'events')).toBe(true);
    });

    it('respects limit', () => {
      expect(service.query({ limit: 2 })).toHaveLength(2);
    });

    it('filters by date range', () => {
      const future = new Date(Date.now() + 60_000);
      expect(service.query({ to: future })).toHaveLength(3);
      const past = new Date(Date.now() - 60_000);
      expect(service.query({ from: future })).toHaveLength(0);
      expect(service.query({ from: past })).toHaveLength(3);
    });
  });

  describe('aggregate', () => {
    it('counts by source', () => {
      service.ingest(makeRecord('events', 'x'));
      service.ingest(makeRecord('events', 'y'));
      service.ingest(makeRecord('metrics', 'z'));
      const agg = service.aggregate();
      expect(agg['events']).toBe(2);
      expect(agg['metrics']).toBe(1);
    });

    it('filters aggregate by source', () => {
      service.ingest(makeRecord('events', 'x'));
      service.ingest(makeRecord('metrics', 'z'));
      const agg = service.aggregate('events');
      expect(agg['events']).toBe(1);
      expect(agg['metrics']).toBeUndefined();
    });
  });
});
