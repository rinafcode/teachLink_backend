import { Test, TestingModule } from '@nestjs/testing';
import { ShutdownStateService } from './shutdown-state.service';

describe('ShutdownStateService', () => {
  let service: ShutdownStateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ShutdownStateService],
    }).compile();

    service = module.get<ShutdownStateService>(ShutdownStateService);
  });

  describe('initial state', () => {
    it('should not be shutting down by default', () => {
      expect(service.isShuttingDown()).toBe(false);
    });

    it('should return null shutdown info before any call', () => {
      const info = service.getShutdownInfo();
      expect(info).toEqual({
        isShuttingDown: false,
        startTime: null,
        reason: null,
        durationMs: null,
      });
    });
  });

  describe('markShuttingDown', () => {
    it('should mark the service as shutting down', () => {
      service.markShuttingDown();
      expect(service.isShuttingDown()).toBe(true);
    });

    it('should use "Unknown" as the default reason', () => {
      service.markShuttingDown();
      const info = service.getShutdownInfo();
      expect(info.reason).toBe('Unknown');
    });

    it('should record the provided reason', () => {
      service.markShuttingDown('SIGTERM received');
      const info = service.getShutdownInfo();
      expect(info.reason).toBe('SIGTERM received');
    });

    it('should record the start time', () => {
      const before = Date.now();
      service.markShuttingDown();
      const info = service.getShutdownInfo();
      expect(info.startTime).toBeGreaterThanOrEqual(before);
      expect(info.startTime).toBeLessThanOrEqual(Date.now());
    });

    it('should be idempotent — second call does not overwrite reason or time', () => {
      const before = Date.now();
      service.markShuttingDown('first reason');

      // Small delay so time could differ
      service.markShuttingDown('second reason');

      const info = service.getShutdownInfo();
      expect(info.reason).toBe('first reason');
      expect(info.startTime).toBeGreaterThanOrEqual(before);
    });

    it('should compute a positive durationMs after marking', () => {
      service.markShuttingDown();
      const info = service.getShutdownInfo();
      expect(info.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getShutdownInfo', () => {
    it('should reflect shutting-down state', () => {
      service.markShuttingDown('drain');
      const info = service.getShutdownInfo();
      expect(info.isShuttingDown).toBe(true);
      expect(info.reason).toBe('drain');
      expect(typeof info.startTime).toBe('number');
      expect(typeof info.durationMs).toBe('number');
    });

    it('should return null fields when not shutting down', () => {
      const info = service.getShutdownInfo();
      expect(info.isShuttingDown).toBe(false);
      expect(info.startTime).toBeNull();
      expect(info.reason).toBeNull();
      expect(info.durationMs).toBeNull();
    });
  });

  describe('reset', () => {
    it('should clear shutting-down state', () => {
      service.markShuttingDown('test');
      service.reset();
      expect(service.isShuttingDown()).toBe(false);
    });

    it('should clear shutdown info', () => {
      service.markShuttingDown('test');
      service.reset();
      const info = service.getShutdownInfo();
      expect(info).toEqual({
        isShuttingDown: false,
        startTime: null,
        reason: null,
        durationMs: null,
      });
    });

    it('should allow re-marking shutdown after reset', () => {
      service.markShuttingDown('first');
      service.reset();
      service.markShuttingDown('second');
      const info = service.getShutdownInfo();
      expect(info.reason).toBe('second');
      expect(info.isShuttingDown).toBe(true);
    });

    it('should be safe to call on an already-clean service', () => {
      expect(() => service.reset()).not.toThrow();
      expect(service.isShuttingDown()).toBe(false);
    });
  });
});
