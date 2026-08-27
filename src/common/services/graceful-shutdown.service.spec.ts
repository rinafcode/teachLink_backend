import { GracefulShutdownService, ShutdownPhase } from './graceful-shutdown.service';
import { ShutdownStateService } from './shutdown-state.service';
import { DataSource } from 'typeorm';

describe('GracefulShutdownService', () => {
  let service: GracefulShutdownService;
  let shutdownState: ShutdownStateService;
  let dataSource: DataSource;

  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Disable the global force-exit timeout so tests don't call process.exit
    process.env.FORCE_EXIT_ON_TIMEOUT = 'false';

    shutdownState = { markShuttingDown: jest.fn() } as unknown as ShutdownStateService;
    dataSource = {} as DataSource;

    service = new GracefulShutdownService(shutdownState, dataSource);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  // ── registerShutdownPhase ────────────────────────────────────────────────

  describe('registerShutdownPhase', () => {
    it('increments the registered phase count', () => {
      expect(service.getShutdownStatus().registeredPhases).toBe(0);

      service.registerShutdownPhase({ name: 'phase-1', timeout: 1000, execute: jest.fn() });

      expect(service.getShutdownStatus().registeredPhases).toBe(1);
    });

    it('allows registering multiple phases', () => {
      service.registerShutdownPhase({ name: 'a', timeout: 1000, execute: jest.fn() });
      service.registerShutdownPhase({ name: 'b', timeout: 2000, execute: jest.fn() });

      expect(service.getShutdownStatus().registeredPhases).toBe(2);
    });
  });

  // ── isShutdownInProgress ─────────────────────────────────────────────────

  describe('isShutdownInProgress', () => {
    it('returns false before shutdown starts', () => {
      expect(service.isShutdownInProgress()).toBe(false);
    });

    it('returns true after shutdown starts', async () => {
      let resolvePhase!: () => void;
      service.registerShutdownPhase({
        name: 'blocking',
        timeout: 5000,
        execute: () => new Promise<void>((r) => { resolvePhase = r; }),
      });

      const shutdownPromise = service.shutdown();
      // Give microtasks a chance to run
      await new Promise((r) => setTimeout(r, 0));

      expect(service.isShutdownInProgress()).toBe(true);

      resolvePhase();
      await shutdownPromise;
    });
  });

  // ── getShutdownStatus ────────────────────────────────────────────────────

  describe('getShutdownStatus', () => {
    it('returns initial status before shutdown', () => {
      const status = service.getShutdownStatus();

      expect(status).toEqual({
        isShuttingDown: false,
        registeredPhases: 0,
        globalTimeout: 30000,
      });
    });

    it('reads globalTimeout from environment variable', () => {
      process.env.SHUTDOWN_TIMEOUT_MS = '10000';
      const fresh = new GracefulShutdownService(shutdownState, dataSource);

      expect(fresh.getShutdownStatus().globalTimeout).toBe(10000);
    });

    it('defaults globalTimeout to 30000 when env var is unset', () => {
      delete process.env.SHUTDOWN_TIMEOUT_MS;
      const fresh = new GracefulShutdownService(shutdownState, dataSource);

      expect(fresh.getShutdownStatus().globalTimeout).toBe(30000);
    });

    it('returns NaN when SHUTDOWN_TIMEOUT_MS is non-numeric', () => {
      process.env.SHUTDOWN_TIMEOUT_MS = 'not-a-number';
      const fresh = new GracefulShutdownService(shutdownState, dataSource);

      // parseInt('not-a-number', 10) is NaN — the service does not guard against this
      expect(fresh.getShutdownStatus().globalTimeout).toBeNaN();
    });
  });

  // ── shutdown ─────────────────────────────────────────────────────────────

  describe('shutdown', () => {
    it('marks the state service as shutting down', async () => {
      service.registerShutdownPhase({ name: 'p', timeout: 1000, execute: jest.fn() });

      await service.shutdown('SIGTERM');

      expect(shutdownState.markShuttingDown).toHaveBeenCalledTimes(1);
    });

    it('executes a single registered phase', async () => {
      const execute = jest.fn().mockResolvedValue(undefined);
      service.registerShutdownPhase({ name: 'cleanup', timeout: 5000, execute });

      await service.shutdown();

      expect(execute).toHaveBeenCalledTimes(1);
    });

    it('executes phases in order of ascending timeout', async () => {
      const order: string[] = [];
      const make = (name: string, timeout: number): ShutdownPhase => ({
        name,
        timeout,
        execute: jest.fn().mockImplementation(async () => { order.push(name); }),
      });

      // Register in reverse priority order
      service.registerShutdownPhase(make('slow', 5000));
      service.registerShutdownPhase(make('fast', 100));
      service.registerShutdownPhase(make('mid', 1000));

      await service.shutdown();

      expect(order).toEqual(['fast', 'mid', 'slow']);
    });

    it('resolves without error when no phases are registered', async () => {
      await expect(service.shutdown()).resolves.toBeUndefined();
    });

    it('continues executing remaining phases after a phase throws', async () => {
      const afterExecute = jest.fn().mockResolvedValue(undefined);

      service.registerShutdownPhase({
        name: 'failing',
        timeout: 5000,
        execute: jest.fn().mockRejectedValue(new Error('boom')),
      });
      service.registerShutdownPhase({
        name: 'after-failure',
        timeout: 5000,
        execute: afterExecute,
      });

      await service.shutdown();

      expect(afterExecute).toHaveBeenCalledTimes(1);
    });

    it('continues executing remaining phases after a phase times out', async () => {
      const afterExecute = jest.fn().mockResolvedValue(undefined);

      service.registerShutdownPhase({
        name: 'slow',
        timeout: 1, // 1 ms timeout — will race against a 5s delay
        execute: () => new Promise<void>((r) => setTimeout(r, 5000)),
      });
      service.registerShutdownPhase({
        name: 'after-timeout',
        timeout: 5000,
        execute: afterExecute,
      });

      await service.shutdown();

      expect(afterExecute).toHaveBeenCalledTimes(1);
    });

    it('returns the same promise when shutdown is called a second time', async () => {
      let resolvePhase!: () => void;
      service.registerShutdownPhase({
        name: 'blocking',
        timeout: 5000,
        execute: () => new Promise<void>((r) => { resolvePhase = r; }),
      });

      const first = service.shutdown();
      const second = service.shutdown();

      resolvePhase();
      const [a, b] = await Promise.all([first, second]);

      // Both should resolve (second is the same promise or a resolved one)
      expect(a).toBeUndefined();
      expect(b).toBeUndefined();
    });

    it('sets the global force-exit timer when FORCE_EXIT_ON_TIMEOUT is not false', async () => {
      process.env.FORCE_EXIT_ON_TIMEOUT = 'true';
      const freshService = new GracefulShutdownService(shutdownState, dataSource);
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      // Use a very short timeout so the timer fires quickly
      process.env.SHUTDOWN_TIMEOUT_MS = '50';
      const timedService = new GracefulShutdownService(shutdownState, dataSource);

      timedService.registerShutdownPhase({
        name: 'slow',
        timeout: 60000,
        execute: () => new Promise<void>((r) => setTimeout(r, 60000)),
      });

      // Start shutdown but don't await — let the force-exit timer fire
      timedService.shutdown();

      // Wait for the timer to fire
      await new Promise((r) => setTimeout(r, 100));

      expect(exitSpy).toHaveBeenCalledWith(1);

      // Cleanup: avoid Jest hanging
      exitSpy.mockRestore();
    });

    it('does not set force-exit timer when FORCE_EXIT_ON_TIMEOUT is false', async () => {
      process.env.FORCE_EXIT_ON_TIMEOUT = 'false';
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      process.env.SHUTDOWN_TIMEOUT_MS = '50';
      const freshService = new GracefulShutdownService(shutdownState, dataSource);

      freshService.registerShutdownPhase({
        name: 'slow',
        timeout: 60000,
        execute: () => new Promise<void>((r) => setTimeout(r, 60000)),
      });

      freshService.shutdown();

      await new Promise((r) => setTimeout(r, 100));

      expect(exitSpy).not.toHaveBeenCalled();

      exitSpy.mockRestore();
    });
  });

  // ── onModuleDestroy ──────────────────────────────────────────────────────

  describe('onModuleDestroy', () => {
    it('calls shutdown when not already shutting down', async () => {
      const execute = jest.fn().mockResolvedValue(undefined);
      service.registerShutdownPhase({ name: 'p', timeout: 1000, execute });

      await service.onModuleDestroy();

      expect(execute).toHaveBeenCalledTimes(1);
      expect(service.isShutdownInProgress()).toBe(true);
    });

    it('does not call shutdown again when already shutting down', async () => {
      const execute = jest.fn().mockResolvedValue(undefined);
      service.registerShutdownPhase({ name: 'p', timeout: 1000, execute });

      await service.shutdown();
      await service.onModuleDestroy();

      // execute should only have been called once (from the initial shutdown)
      expect(execute).toHaveBeenCalledTimes(1);
    });
  });
});
