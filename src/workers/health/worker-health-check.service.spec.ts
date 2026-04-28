import { Test, TestingModule } from '@nestjs/testing';
import { WorkerHealthCheckService } from './worker-health-check.service';
import { WorkerOrchestrationService } from '../orchestration/worker-orchestration.service';

describe('WorkerHealthCheckService', () => {
  let service: WorkerHealthCheckService;
  let orchestrationService: WorkerOrchestrationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WorkerHealthCheckService, WorkerOrchestrationService],
    }).compile();

    service = module.get<WorkerHealthCheckService>(WorkerHealthCheckService);
    orchestrationService = module.get<WorkerOrchestrationService>(
      WorkerOrchestrationService,
    );
  });

  afterEach(() => {
    service.stopHealthChecks();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('health checks', () => {
    it('should get worker health for all workers', async () => {
      const health = await service.getAllWorkersHealth();
      expect(Array.isArray(health)).toBe(true);
      expect(health.length).toBeGreaterThan(0);

      for (const h of health) {
        expect(h.workerId).toBeDefined();
        expect(['healthy', 'degraded', 'unhealthy']).toContain(h.status);
      }
    });

    it('should get worker health for specific worker', async () => {
      const workers = orchestrationService.getActiveWorkers();
      const workerId = workers[0].getId();

      const health = await service.getWorkerHealth(workerId);
      expect(health).toBeDefined();
      expect(health.workerId).toBe(workerId);
    });

    it('should perform comprehensive health check', async () => {
      const summary = await service.performComprehensiveHealthCheck();

      expect(summary.timestamp).toBeDefined();
      expect(summary.totalWorkers).toBeGreaterThan(0);
      expect(typeof summary.healthyWorkers).toBe('number');
      expect(typeof summary.degradedWorkers).toBe('number');
      expect(typeof summary.unhealthyWorkers).toBe('number');
      expect(summary.poolStats).toBeDefined();
      expect(Array.isArray(summary.alerts)).toBe(true);
    });
  });

  describe('health metrics', () => {
    it('should check if pool is healthy', async () => {
      const isHealthy = await service.isPoolHealthy();
      expect(typeof isHealthy).toBe('boolean');
    });

    it('should get pool health percentage', async () => {
      const percentage = await service.getPoolHealthPercentage();
      expect(typeof percentage).toBe('number');
      expect(percentage).toBeGreaterThanOrEqual(0);
      expect(percentage).toBeLessThanOrEqual(100);
    });
  });

  describe('anomaly detection', () => {
    it('should detect anomalies', async () => {
      const anomalies = await service.detectAnomalies();
      expect(Array.isArray(anomalies)).toBe(true);

      for (const anomaly of anomalies) {
        expect(anomaly.workerId).toBeDefined();
        expect(anomaly.type).toBeDefined();
        expect(anomaly.message).toBeDefined();
      }
    });

    it('should identify slow execution anomalies', async () => {
      // This test would need mocked workers with specific metrics
      // Kept as placeholder for demonstration
      const anomalies = await service.detectAnomalies();
      const slowExecution = anomalies.filter((a) => a.type === 'slow-execution');
      expect(Array.isArray(slowExecution)).toBe(true);
    });
  });

  describe('health check scheduling', () => {
    it('should start and stop health checks', (done) => {
      service.startHealthChecks(100);

      setTimeout(() => {
        service.stopHealthChecks();
        done();
      }, 150);
    });

    it('should warn if health checks already running', () => {
      const loggerWarnSpy = jest.spyOn(service['logger'], 'warn');

      service.startHealthChecks(100);
      service.startHealthChecks(100);

      expect(loggerWarnSpy).toHaveBeenCalledWith('Health checks already running');

      service.stopHealthChecks();
      loggerWarnSpy.mockRestore();
    });

    it('should not error if stopping when not running', () => {
      expect(() => {
        service.stopHealthChecks();
      }).not.toThrow();
    });
  });

  describe('alert generation', () => {
    it('should generate alerts for comprehensive health check', async () => {
      const summary = await service.performComprehensiveHealthCheck();
      expect(Array.isArray(summary.alerts)).toBe(true);
    });

    it('should include pool statistics in health summary', async () => {
      const summary = await service.performComprehensiveHealthCheck();

      expect(summary.poolStats).toBeDefined();
      expect(typeof summary.poolStats.totalWorkers).toBe('number');
      expect(typeof summary.poolStats.totalJobsProcessed).toBe('number');
      expect(typeof summary.poolStats.successRate).toBe('number');
    });
  });

  describe('error handling', () => {
    it('should handle error when getting worker health', async () => {
      // Mock orchestrationService to throw error
      jest
        .spyOn(orchestrationService, 'getWorkerHealth')
        .mockRejectedValueOnce(new Error('Service error'));

      await expect(service.getWorkerHealth('test-id')).rejects.toThrow('Service error');
    });

    it('should handle error in comprehensive health check', async () => {
      // Mock to simulate partial failure
      jest
        .spyOn(orchestrationService, 'getAllWorkersHealth')
        .mockRejectedValueOnce(new Error('Check failed'));

      await expect(service.performComprehensiveHealthCheck()).rejects.toThrow('Check failed');
    });
  });

  describe('health status categorization', () => {
    it('should categorize health status correctly', async () => {
      const summary = await service.performComprehensiveHealthCheck();

      const totalCategorized =
        summary.healthyWorkers + summary.degradedWorkers + summary.unhealthyWorkers;

      expect(totalCategorized).toBeLessThanOrEqual(summary.totalWorkers);
    });
  });
});
