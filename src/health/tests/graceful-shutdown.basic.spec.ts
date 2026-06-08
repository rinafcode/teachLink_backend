import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { GracefulShutdownService } from '../../common/services/graceful-shutdown.service';
import { RequestTrackerService } from '../../common/services/request-tracker.service';
import { ShutdownStateService } from '../../common/services/shutdown-state.service';

describe('Graceful Shutdown Basic Tests', () => {
  let gracefulShutdown: GracefulShutdownService;
  let requestTracker: RequestTrackerService;
  let shutdownState: ShutdownStateService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        GracefulShutdownService,
        RequestTrackerService,
        ShutdownStateService,
        {
          provide: getDataSourceToken(),
          useValue: {
            isInitialized: true,
            destroy: jest.fn().mockResolvedValue(undefined),
            driver: {
              master: {
                pool: {
                  totalCount: 5,
                  idleCount: 3,
                  waitingCount: 0,
                },
              },
            },
            query: jest.fn().mockResolvedValue([{ active_count: '0' }]),
          },
        },
      ],
    }).compile();

    gracefulShutdown = moduleFixture.get<GracefulShutdownService>(GracefulShutdownService);
    requestTracker = moduleFixture.get<RequestTrackerService>(RequestTrackerService);
    shutdownState = moduleFixture.get<ShutdownStateService>(ShutdownStateService);
  });

  describe('Shutdown State Management', () => {
    it('should track shutdown state correctly', () => {
      expect(shutdownState.isShuttingDown()).toBe(false);

      shutdownState.markShuttingDown('Test shutdown');

      expect(shutdownState.isShuttingDown()).toBe(true);

      const info = shutdownState.getShutdownInfo();
      expect(info.isShuttingDown).toBe(true);
      expect(info.reason).toBe('Test shutdown');
      expect(info.startTime).toBeDefined();
      expect(info.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should reset shutdown state', () => {
      shutdownState.markShuttingDown('Test');
      expect(shutdownState.isShuttingDown()).toBe(true);

      shutdownState.reset();
      expect(shutdownState.isShuttingDown()).toBe(false);

      const info = shutdownState.getShutdownInfo();
      expect(info.isShuttingDown).toBe(false);
      expect(info.startTime).toBeNull();
      expect(info.reason).toBeNull();
    });
  });

  describe('Request Tracking', () => {
    it('should track active requests', () => {
      expect(requestTracker.getActiveRequestCount()).toBe(0);

      // Simulate a request by manually calling the middleware
      const mockReq = {
        method: 'GET',
        url: '/test',
        get: jest.fn().mockReturnValue('test-agent'),
      } as any;

      const mockRes = {
        locals: {},
        on: jest.fn(),
      } as any;

      const mockNext = jest.fn();

      const middleware = requestTracker.trackRequest();
      middleware(mockReq, mockRes, mockNext);

      expect(requestTracker.getActiveRequestCount()).toBe(1);
      expect(mockNext).toHaveBeenCalled();

      const activeRequests = requestTracker.getActiveRequests();
      expect(activeRequests).toHaveLength(1);
      expect(activeRequests[0].method).toBe('GET');
      expect(activeRequests[0].url).toBe('/test');
    });

    it('should wait for active requests to complete', async () => {
      const waitPromise = requestTracker.waitForActiveRequests(1000);

      // Should resolve immediately when no active requests
      await expect(waitPromise).resolves.toBeUndefined();
    });

    it('should timeout when waiting for requests', async () => {
      // Simulate an active request
      const mockReq = { method: 'GET', url: '/test', get: jest.fn() } as any;
      const mockRes = { locals: {}, on: jest.fn() } as any;
      const mockNext = jest.fn();

      const middleware = requestTracker.trackRequest();
      middleware(mockReq, mockRes, mockNext);

      // Should timeout since request never completes
      await expect(requestTracker.waitForActiveRequests(100)).rejects.toThrow(
        'Timeout waiting for',
      );
    });

    it('should get request statistics', () => {
      const stats = requestTracker.getStatistics();
      expect(stats).toHaveProperty('activeCount');
      expect(stats).toHaveProperty('totalProcessed');
      expect(stats).toHaveProperty('longestRunningMs');
      expect(stats).toHaveProperty('averageDurationMs');
    });
  });

  describe('Graceful Shutdown Orchestration', () => {
    it('should register and execute shutdown phases', async () => {
      const executionOrder: string[] = [];

      gracefulShutdown.registerShutdownPhase({
        name: 'phase-1',
        timeout: 1000,
        execute: async () => {
          executionOrder.push('phase-1');
        },
      });

      gracefulShutdown.registerShutdownPhase({
        name: 'phase-2',
        timeout: 500, // Shorter timeout should execute first
        execute: async () => {
          executionOrder.push('phase-2');
        },
      });

      await gracefulShutdown.shutdown('TEST');

      expect(executionOrder).toEqual(['phase-2', 'phase-1']);
      expect(gracefulShutdown.isShutdownInProgress()).toBe(true);
    });

    it('should handle phase timeouts gracefully', async () => {
      gracefulShutdown.registerShutdownPhase({
        name: 'slow-phase',
        timeout: 100,
        execute: async () => {
          await new Promise((resolve) => setTimeout(resolve, 200)); // Takes longer than timeout
        },
      });

      gracefulShutdown.registerShutdownPhase({
        name: 'fast-phase',
        timeout: 1000,
        execute: async () => {
          // Should still execute even if previous phase times out
        },
      });

      // Should not throw even with timeout
      await expect(gracefulShutdown.shutdown('TEST')).resolves.toBeUndefined();
    });

    it('should get shutdown status', () => {
      const status = gracefulShutdown.getShutdownStatus();
      expect(status).toHaveProperty('isShuttingDown');
      expect(status).toHaveProperty('registeredPhases');
      expect(status).toHaveProperty('globalTimeout');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete shutdown sequence', async () => {
      // Register all shutdown phases
      gracefulShutdown.registerShutdownPhase({
        name: 'stop-requests',
        timeout: 1000,
        execute: async () => {
          shutdownState.markShuttingDown('Integration test');
        },
      });

      gracefulShutdown.registerShutdownPhase({
        name: 'wait-requests',
        timeout: 2000,
        execute: async () => {
          await requestTracker.waitForActiveRequests(1000);
        },
      });

      // Execute complete shutdown
      await expect(gracefulShutdown.shutdown('INTEGRATION_TEST')).resolves.toBeUndefined();

      // Verify final state
      expect(shutdownState.isShuttingDown()).toBe(true);
      expect(gracefulShutdown.isShutdownInProgress()).toBe(true);
    });

    it('should handle shutdown with active requests', async () => {
      // Simulate an active request
      const mockReq = { method: 'GET', url: '/test', get: jest.fn() } as any;
      const mockRes = {
        locals: {},
        on: jest.fn((event, callback) => {
          // Simulate request completion after a short delay
          if (event === 'finish') {
            setTimeout(callback, 50);
          }
        }),
      } as any;
      const mockNext = jest.fn();

      const middleware = requestTracker.trackRequest();
      middleware(mockReq, mockRes, mockNext);

      expect(requestTracker.getActiveRequestCount()).toBe(1);

      // Register shutdown phase that waits for requests
      gracefulShutdown.registerShutdownPhase({
        name: 'wait-requests',
        timeout: 2000,
        execute: async () => {
          await requestTracker.waitForActiveRequests(1000);
        },
      });

      // Trigger request completion
      const finishCallback = mockRes.on.mock.calls.find((call) => call[0] === 'finish')?.[1];
      if (finishCallback) {
        setTimeout(finishCallback, 100);
      }

      // Execute shutdown - should wait for request to complete
      await expect(gracefulShutdown.shutdown('TEST_WITH_REQUESTS')).resolves.toBeUndefined();
    });
  });
});
