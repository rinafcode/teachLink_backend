import { Test, TestingModule } from '@nestjs/testing';
import { BaseWorker } from './base.worker';
import { Job } from 'bull';

// Mock worker for testing
class TestWorker extends BaseWorker {
  async execute(job: Job): Promise<any> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return { status: 'completed', jobId: job.id };
  }
}

describe('BaseWorker', () => {
  let worker: TestWorker;

  beforeEach(() => {
    worker = new TestWorker();
  });

  describe('initialization', () => {
    it('should create worker with unique ID', () => {
      expect(worker.getId()).toBeDefined();
      expect(worker.getId()).toContain('test-worker');
    });

    it('should have correct worker type', () => {
      expect(worker.getType()).toBe('test-worker');
    });

    it('should initialize with zero metrics', () => {
      const metrics = worker.getMetrics();
      expect(metrics.jobsProcessed).toBe(0);
      expect(metrics.jobsFailed).toBe(0);
      expect(metrics.jobsSucceeded).toBe(0);
    });
  });

  describe('handle', () => {
    it('should successfully process a job', async () => {
      const mockJob = {
        id: '1',
        name: 'test-job',
        data: { test: 'data' },
        progress: jest.fn(),
        attemptsMade: 0,
      } as any;

      const result = await worker.handle(mockJob);

      expect(result.success).toBe(true);
      expect(result.data.jobId).toBe('1');
      expect(result.workerId).toBeDefined();
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should track job metrics on success', async () => {
      const mockJob = {
        id: '1',
        name: 'test-job',
        data: { test: 'data' },
        progress: jest.fn(),
        attemptsMade: 0,
      } as any;

      await worker.handle(mockJob);

      expect(worker.getJobsProcessed()).toBe(1);
      const metrics = worker.getMetrics();
      expect(metrics.jobsSucceeded).toBe(1);
      expect(metrics.jobsFailed).toBe(0);
    });

    it('should handle job failure', async () => {
      class FailingWorker extends BaseWorker {
        async execute(): Promise<any> {
          throw new Error('Job failed');
        }
      }

      const failingWorker = new FailingWorker();

      const mockJob = {
        id: '1',
        name: 'failing-job',
        data: {},
        progress: jest.fn(),
        attemptsMade: 0,
      } as any;

      await expect(failingWorker.handle(mockJob)).rejects.toThrow('Job failed');
      expect(failingWorker.getJobsProcessed()).toBe(1);
      const metrics = failingWorker.getMetrics();
      expect(metrics.jobsFailed).toBe(1);
      expect(metrics.jobsSucceeded).toBe(0);
    });

    it('should update progress', async () => {
      const mockJob = {
        id: '1',
        name: 'test-job',
        data: {},
        progress: jest.fn(),
        attemptsMade: 0,
      } as any;

      await worker.handle(mockJob);

      expect(mockJob.progress).toHaveBeenCalledWith(10);
      expect(mockJob.progress).toHaveBeenCalledWith(100);
    });
  });

  describe('metrics', () => {
    it('should calculate correct average execution time', async () => {
      const mockJob = {
        id: '1',
        name: 'test-job',
        data: {},
        progress: jest.fn(),
        attemptsMade: 0,
      } as any;

      await worker.handle(mockJob);
      await worker.handle({ ...mockJob, id: '2' });

      const metrics = worker.getMetrics();
      expect(metrics.averageExecutionTime).toBeGreaterThan(0);
      expect(metrics.jobsProcessed).toBe(2);
    });

    it('should determine health status based on failure rate', async () => {
      class FailingWorker extends BaseWorker {
        async execute(): Promise<any> {
          throw new Error('Job failed');
        }
      }

      const failingWorker = new FailingWorker();

      const mockJob = {
        id: '1',
        name: 'failing-job',
        data: {},
        progress: jest.fn(),
        attemptsMade: 0,
      } as any;

      // Generate some failures
      for (let i = 0; i < 5; i++) {
        try {
          await failingWorker.handle({ ...mockJob, id: `${i}` });
        } catch {
          // Expected to fail
        }
      }

      const metrics = failingWorker.getMetrics();
      expect(metrics.status).not.toBe('healthy');
    });

    it('should track uptime', () => {
      const uptime = worker.getUptime();
      expect(uptime).toBeGreaterThanOrEqual(0);
      expect(typeof uptime).toBe('number');
    });
  });

  describe('health check', () => {
    it('should return healthy status for idle worker', async () => {
      const health = await worker.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.workerId).toBeDefined();
      expect(health.lastCheck).toBeDefined();
    });

    it('should detect unhealthy workers', async () => {
      class FailingWorker extends BaseWorker {
        async execute(): Promise<any> {
          throw new Error('Job failed');
        }
      }

      const failingWorker = new FailingWorker();

      const mockJob = {
        id: '1',
        name: 'failing-job',
        data: {},
        progress: jest.fn(),
        attemptsMade: 0,
      } as any;

      // Create high failure rate
      for (let i = 0; i < 10; i++) {
        try {
          await failingWorker.handle({ ...mockJob, id: `${i}` });
        } catch {
          // Expected to fail
        }
      }

      const health = await failingWorker.healthCheck();
      expect(health.status).toBe('unhealthy');
    });
  });

  describe('reset metrics', () => {
    it('should reset all metrics', async () => {
      const mockJob = {
        id: '1',
        name: 'test-job',
        data: {},
        progress: jest.fn(),
        attemptsMade: 0,
      } as any;

      await worker.handle(mockJob);
      expect(worker.getJobsProcessed()).toBe(1);

      worker.resetMetrics();
      expect(worker.getJobsProcessed()).toBe(0);

      const metrics = worker.getMetrics();
      expect(metrics.jobsProcessed).toBe(0);
      expect(metrics.jobsSucceeded).toBe(0);
      expect(metrics.totalExecutionTime).toBe(0);
    });
  });
});
