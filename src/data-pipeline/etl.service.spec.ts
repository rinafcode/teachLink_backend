import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EtlService } from './etl.service';

describe('EtlService', () => {
  let service: EtlService;
  let emitter: EventEmitter2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EtlService, { provide: EventEmitter2, useValue: { emit: jest.fn() } }],
    }).compile();

    service = module.get(EtlService);
    emitter = module.get(EventEmitter2);
  });

  describe('extract', () => {
    it('returns one record per raw item', () => {
      const records = service.extract('test', [{ a: 1 }, { b: 2 }]);
      expect(records).toHaveLength(2);
      expect(records[0].source).toBe('test');
      expect(records[0].payload).toEqual({ a: 1 });
    });

    it('returns empty array for empty input', () => {
      expect(service.extract('src', [])).toEqual([]);
    });
  });

  describe('transform', () => {
    it('adds _processedAt and _source to payload', () => {
      const records = service.extract('src', [{ x: 1 }]);
      const transformed = service.transform(records);
      expect(transformed[0].payload._processedAt).toBeDefined();
      expect(transformed[0].payload._source).toBe('src');
    });

    it('filters out records with empty payload', () => {
      const records = service.extract('src', [{}, { y: 2 }]);
      // {} has no keys, should be filtered
      const transformed = service.transform(records);
      expect(transformed).toHaveLength(1);
    });
  });

  describe('load', () => {
    it('emits etl.record.loaded for each record', async () => {
      const records = service.extract('src', [{ a: 1 }, { b: 2 }]);
      const transformed = service.transform(records);
      await service.load(transformed);
      expect(emitter.emit).toHaveBeenCalledTimes(transformed.length);
      expect(emitter.emit).toHaveBeenCalledWith(
        'etl.record.loaded',
        expect.objectContaining({ source: 'src' }),
      );
    });
  });

  describe('run', () => {
    it('returns correct counts', async () => {
      const result = await service.run('src', [{ a: 1 }, { b: 2 }]);
      expect(result.extracted).toBe(2);
      expect(result.transformed).toBe(2);
      expect(result.loaded).toBe(2);
      expect(result.errors).toBe(0);
    });

    it('emits etl.run.complete', async () => {
      await service.run('src', [{ a: 1 }]);
      expect(emitter.emit).toHaveBeenCalledWith(
        'etl.run.complete',
        expect.objectContaining({ source: 'src' }),
      );
    });

    it('increments errors on failure', async () => {
      jest.spyOn(service, 'extract').mockImplementation(() => {
        throw new Error('fail');
      });
      const result = await service.run('src', [{ a: 1 }]);
      expect(result.errors).toBe(1);
    });
  });
});
