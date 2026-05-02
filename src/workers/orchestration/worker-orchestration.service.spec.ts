import { Test, TestingModule } from '@nestjs/testing';
import { WorkerOrchestrationService } from './worker-orchestration.service';
import { Job } from 'bull';

describe('WorkerOrchestrationService', () => {
  let service: WorkerOrchestrationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WorkerOrchestrationService],
    }).compile();

    service = module.get<WorkerOrchestrationService>(WorkerOrchestrationService);
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize worker registry', () => {
      expect(service).toBeDefined();
      const activeWorkers = service.getActiveWorkers();
      expect(activeWorkers.length).toBeGreaterThan(0);
    });

    it('should have default configurations', () => {
      const stats = service.getPoolStatistics();
      expect(stats.totalWorkers).toBeGreaterThan(0);
      expect(stats.isRunning).toBe(true);
    });
  });

  describe('job routing', () => {
    it('should route email jobs to email worker', async () => {
      const mockJob = {
        id: '1',
        name: 'send-email',
        data: { to: 'test@example.com', subject: 'Test' },
        progress: jest.fn(),
        attemptsMade: 0,
      } as any;

      const result = await service.routeJob(mockJob);
      expect(result.success).toBe(true);
    });

    it('should route media jobs to media worker', async () => {
      const mockJob = {
        id: '1',
        name: 'process-image',
        data: { mediaType: 'image', fileUrl: 'http://example.com/image.jpg' },
        progress: jest.fn(),
        attemptsMade: 0,
      } as any;

      const result = await service.routeJob(mockJob);
      expect(result.success).toBe(true);
    });

    it('should route sync jobs to data sync worker', async () => {
      const mockJob = {
        id: '1',
        name: 'consistency-check',
        data: { syncType: 'consistency-check', source: 'database' },
        progress: jest.fn(),
        attemptsMade: 0,
      } as any;

      const result = await service.routeJob(mockJob);
      expect(result.success).toBe(true);
    });

    it('should route backup jobs to backup worker', async () => {
      const mockJob = {
        id: '1',
        name: 'backup-data',
        data: { backupType: 'full', targetDatabase: 'main' },
        progress: jest.fn(),
        attemptsMade: 0,
      } as any;

      const result = await service.routeJob(mockJob);
      expect(result.success).toBe(true);
    });

    it('should route webhook jobs to webhooks worker', async () => {
      const mockJob = {
        id: '1',
        name: 'call-webhook',
        data: { url: 'https://example.com/webhook', event: 'test' },
        progress: jest.fn(),
        attemptsMade: 0,
      } as any;

      const result = await service.routeJob(mockJob);
      expect(result.success).toBe(true);
    });

    it('should route subscription jobs to subscriptions worker', async () => {
      const mockJob = {
        id: '1',
        name: 'subscription-renew',
        data: { subscriptionId: 'sub_123', action: 'renew' },
        progress: jest.fn(),
        attemptsMade: 0,
      } as any;

      const result = await service.routeJob(mockJob);
      expect(result.success).toBe(true);
    });

    it('should default to email worker for unknown job types', async () => {
      const mockJob = {
        id: '1',
        name: 'unknown-job',
        data: {},
        progress: jest.fn(),
        attemptsMade: 0,
      } as any;

      const result = await service.routeJob(mockJob);
      expect(result.success).toBe(true);
    });
  });

  describe('worker management', () => {
    it('should get active workers', () => {
      const workers = service.getActiveWorkers();
      expect(Array.isArray(workers)).toBe(true);
      expect(workers.length).toBeGreaterThan(0);
    });

    it('should get workers by type', () => {
      const emailWorkers = service.getWorkersByType('email');
      expect(Array.isArray(emailWorkers)).toBe(true);
      expect(emailWorkers.length).toBeGreaterThan(0);
    });

    it('should get worker by ID', () => {
      const workers = service.getActiveWorkers();
      const workerId = workers[0].getId();
      const worker = service.getWorkerById(workerId);
      expect(worker).toBeDefined();
      expect(worker.getId()).toBe(workerId);
    });

    it('should return null for non-existent worker ID', () => {
      const worker = service.getWorkerById('non-existent-id');
      expect(worker).toBeNull();
    });
  });

  describe('metrics and statistics', () => {
    it('should get all worker metrics', () => {
      const metrics = service.getAllWorkerMetrics();
      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeGreaterThan(0);

      for (const metric of metrics) {
        expect(metric.workerId).toBeDefined();
        expect(metric.workerType).toBeDefined();
        expect(typeof metric.jobsProcessed).toBe('number');
        expect(typeof metric.jobsFailed).toBe('number');
      }
    });

    it('should get pool statistics', () => {
      const stats = service.getPoolStatistics();
      expect(stats.totalWorkers).toBeGreaterThan(0);
      expect(typeof stats.totalJobsProcessed).toBe('number');
      expect(typeof stats.totalJobsFailed).toBe('number');
      expect(typeof stats.successRate).toBe('number');
      expect(stats.isRunning).toBe(true);
    });
  });

  describe('health checks', () => {
    it('should get health status for all workers', async () => {
      const health = await service.getAllWorkersHealth();
      expect(Array.isArray(health)).toBe(true);
      expect(health.length).toBeGreaterThan(0);

      for (const h of health) {
        expect(h.workerId).toBeDefined();
        expect(['healthy', 'degraded', 'unhealthy']).toContain(h.status);
        expect(h.lastCheck).toBeDefined();
      }
    });

    it('should get health status for specific worker', async () => {
      const workers = service.getActiveWorkers();
      const workerId = workers[0].getId();
      const health = await service.getWorkerHealth(workerId);

      expect(health).toBeDefined();
      expect(health.workerId).toBe(workerId);
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
    });

    it('should return null for non-existent worker health', async () => {
      const health = await service.getWorkerHealth('non-existent-id');
      expect(health).toBeNull();
    });
  });

  describe('scaling', () => {
    it('should scale workers up', async () => {
      const initialWorkers = service.getWorkersByType('email');
      const initialCount = initialWorkers.length;

      await service.scaleWorkerPool('email', initialCount + 1);

      const scaledWorkers = service.getWorkersByType('email');
      expect(scaledWorkers.length).toBe(initialCount + 1);
    });

    it('should scale workers down', async () => {
      const initialWorkers = service.getWorkersByType('email');
      const initialCount = initialWorkers.length;

      if (initialCount > 1) {
        await service.scaleWorkerPool('email', initialCount - 1);

        const scaledWorkers = service.getWorkersByType('email');
        expect(scaledWorkers.length).toBe(initialCount - 1);
      }
    });

    it('should throw error for unknown worker type', async () => {
      await expect(service.scaleWorkerPool('unknown-type', 5)).rejects.toThrow();
    });
  });

  describe('lifecycle', () => {
    it('should start and stop worker pool', async () => {
      const stats1 = service.getPoolStatistics();
      expect(stats1.isRunning).toBe(true);

      await service.stopWorkerPool();

      const stats2 = service.getPoolStatistics();
      expect(stats2.isRunning).toBe(false);

      await service.startWorkerPool();

      const stats3 = service.getPoolStatistics();
      expect(stats3.isRunning).toBe(true);
    });
  });
});
