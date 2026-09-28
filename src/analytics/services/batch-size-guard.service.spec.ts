import { Test, TestingModule } from '@nestjs/testing';
import { BatchSizeGuardService } from './batch-size-guard.service';

describe('BatchSizeGuardService', () => {
  let service: BatchSizeGuardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BatchSizeGuardService],
    }).compile();

    service = module.get<BatchSizeGuardService>(BatchSizeGuardService);
  });

  // ── canAdd ───────────────────────────────────────────────────────────────

  describe('canAdd', () => {
    it('returns true when batch is below the maximum', () => {
      expect(service.canAdd(0)).toBe(true);
      expect(service.canAdd(9999)).toBe(true);
    });

    it('returns false when batch is at the maximum', () => {
      expect(service.canAdd(10000)).toBe(false);
    });

    it('returns false when batch exceeds the maximum', () => {
      expect(service.canAdd(10001)).toBe(false);
    });

    it('increments the dropped count when rejecting', () => {
      service.canAdd(10000);
      service.canAdd(10001);

      expect(service.getDroppedCount()).toBe(2);
    });

    it('does not increment dropped count on acceptance', () => {
      service.canAdd(0);
      service.canAdd(5000);

      expect(service.getDroppedCount()).toBe(0);
    });
  });

  // ── getDroppedCount ──────────────────────────────────────────────────────

  describe('getDroppedCount', () => {
    it('starts at zero', () => {
      expect(service.getDroppedCount()).toBe(0);
    });

    it('accumulates across multiple rejections', () => {
      service.canAdd(10000);
      service.canAdd(10000);
      service.canAdd(10000);

      expect(service.getDroppedCount()).toBe(3);
    });
  });

  // ── resetDroppedCount ────────────────────────────────────────────────────

  describe('resetDroppedCount', () => {
    it('resets the counter to zero', () => {
      service.canAdd(10000);
      service.canAdd(10000);

      service.resetDroppedCount();

      expect(service.getDroppedCount()).toBe(0);
    });

    it('is idempotent when counter is already zero', () => {
      service.resetDroppedCount();

      expect(service.getDroppedCount()).toBe(0);
    });
  });
});
