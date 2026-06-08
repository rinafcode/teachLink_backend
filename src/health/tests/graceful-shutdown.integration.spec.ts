import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GracefulShutdownService } from '../../common/services/graceful-shutdown.service';
import { RequestTrackerService } from '../../common/services/request-tracker.service';
import { DatabaseShutdownService } from '../../database/services/database-shutdown.service';
import { WorkerShutdownService } from '../../workers/services/worker-shutdown.service';
import { ShutdownStateService } from '../../common/services/shutdown-state.service';
import { HealthModule } from '../health.module';
import request from 'supertest';

describe('Graceful Shutdown Integration', () => {
  let app: INestApplication;
  let gracefulShutdown: GracefulShutdownService;
  let requestTracker: RequestTrackerService;
  let databaseShutdown: DatabaseShutdownService;
  let workerShutdown: WorkerShutdownService;
  let shutdownState: ShutdownStateService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          autoLoadEntities: true,
          synchronize: true,
        }),
        HealthModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    gracefulShutdown = app.get<GracefulShutdownService>(GracefulShutdownService);
    requestTracker = app.get<RequestTrackerService>(RequestTrackerService);
    databaseShutdown = app.get<DatabaseShutdownService>(DatabaseShutdownService);
    workerShutdown = app.get<WorkerShutdownService>(WorkerShutdownService);
    shutdownState = app.get<ShutdownStateService>(ShutdownStateService);

    // Add request tracking middleware
    app.use(requestTracker.trackRequest());

    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
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
      expect(info.durationMs).toBeGreaterThan(0);
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
    it('should track active requests', async () => {
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
      await expect(requestTracker.waitForActiveRequests(100)).rejects.toThrow('Timeout waiting for');
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
          await new Promise(resolve => setTimeout(resolve, 200)); // Takes longer than timeout
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
  });

  describe('Health Endpoints', () => {
    it('should return healthy status when not shutting down', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/shutdown')
        .expect(200);
      
      expect(response.body.status).toBe('healthy');
      expect(response.body.shutdown.isShuttingDown).toBe(false);
      expect(response.body.readiness.acceptingRequests).toBe(true);
    });

    it('should return shutting down status during shutdown', async () => {
      shutdownState.markShuttingDown('Test shutdown');
      
      const response = await request(app.getHttpServer())
        .get('/health/shutdown')
        .expect(200);
      
      expect(response.body.status).toBe('shutting_down');
      expect(response.body.shutdown.isShuttingDown).toBe(true);
      expect(response.body.readiness.acceptingRequests).toBe(false);
    });

    it('should return readiness status', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/shutdown/readiness')
        .expect(200);
      
      expect(response.body.ready).toBe(true);
      expect(response.body.activeRequests).toBe(0);
      expect(response.body.activeJobs).toBe(0);
    });

    it('should return not ready during shutdown', async () => {
      shutdownState.markShuttingDown('Test');
      
      const response = await request(app.getHttpServer())
        .get('/health/shutdown/readiness')
        .expect(200);
      
      expect(response.body.ready).toBe(false);
      expect(response.body.reason).toBe('Application is shutting down');
    });

    it('should return detailed shutdown status', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/shutdown/detailed')
        .expect(200);
      
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('shutdown');
      expect(response.body).toHaveProperty('gracefulShutdown');
      expect(response.body).toHaveProperty('requests');
      expect(response.body).toHaveProperty('database');
      expect(response.body).toHaveProperty('workers');
    });
  });

  describe('Database Shutdown', () => {
    it('should track database shutdown state', () => {
      const status = databaseShutdown.getShutdownStatus();
      expect(status.isShuttingDown).toBe(false);
      expect(status.options).toBeDefined();
      expect(status.poolSnapshot).toBeDefined();
    });
  });

  describe('Worker Shutdown', () => {
    it('should track worker shutdown state', () => {
      const status = workerShutdown.getShutdownStatus();
      expect(status.phase).toBe('idle');
      expect(status.options).toBeDefined();
    });

    it('should handle emergency stop', async () => {
      await expect(workerShutdown.emergencyStop()).resolves.toBeUndefined();
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

      gracefulShutdown.registerShutdownPhase({
        name: 'shutdown-workers',
        timeout: 3000,
        execute: async () => {
          await workerShutdown.shutdown();
        },
      });

      gracefulShutdown.registerShutdownPhase({
        name: 'shutdown-database',
        timeout: 2000,
        execute: async () => {
          await databaseShutdown.shutdown();
        },
      });

      // Execute complete shutdown
      await expect(gracefulShutdown.shutdown('INTEGRATION_TEST')).resolves.toBeUndefined();
      
      // Verify final state
      expect(shutdownState.isShuttingDown()).toBe(true);
      expect(gracefulShutdown.isShutdownInProgress()).toBe(true);
      expect(databaseShutdown.getShutdownStatus().isShuttingDown).toBe(true);
      expect(workerShutdown.getShutdownStatus().phase).toBe('completed');
    });
  });
});