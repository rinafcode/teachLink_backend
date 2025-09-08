import { Test, TestingModule } from '@nestjs/testing';
import { QueueOptimizationService, OptimizationStrategy } from '../optimization/queue-optimization.service';
import { JobStatus } from '../interfaces/job.interface';

describe('QueueOptimizationService', () => {
  let service: QueueOptimizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [QueueOptimizationService],
    }).compile();

    service = module.get<QueueOptimizationService>(QueueOptimizationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Optimization Configuration', () => {
    it('should set and get optimization configuration', () => {
      const config = {
        enabled: true,
        strategies: [
          OptimizationStrategy.CONCURRENCY_SCALING,
          OptimizationStrategy.BATCHING,
        ],
        minConcurrency: 1,
        maxConcurrency: 10,
        batchSize: 5,
        adaptiveTimeoutEnabled: true,
        minTimeout: 1000,
        maxTimeout: 30000,
        priorityBoostAge: 300000, // 5 minutes
        priorityBoostFactor: 1.5,
        loadSheddingThreshold: 0.9,
      };

      service.setOptimizationConfig(config);
      const retrievedConfig = service.getOptimizationConfig();

      expect(retrievedConfig).toEqual(config);
    });

    it('should have default configuration', () => {
      const config = service.getOptimizationConfig();
      
      expect(config).toBeDefined();
      expect(config.enabled).toBeDefined();
      expect(config.strategies).toBeDefined();
      expect(config.minConcurrency).toBeDefined();
      expect(config.maxConcurrency).toBeDefined();
    });
  });

  describe('Optimization Control', () => {
    it('should start and stop optimization', () => {
      // Start optimization
      service.startOptimization();
      expect(service.isOptimizationEnabled()).toBe(true);
      
      // Stop optimization
      service.stopOptimization();
      expect(service.isOptimizationEnabled()).toBe(false);
    });
  });

  describe('Concurrency Optimization', () => {
    beforeEach(() => {
      service.setOptimizationConfig({
        enabled: true,
        strategies: [OptimizationStrategy.CONCURRENCY_SCALING],
        minConcurrency: 1,
        maxConcurrency: 10,
        batchSize: 1,
        adaptiveTimeoutEnabled: false,
        minTimeout: 1000,
        maxTimeout: 30000,
        priorityBoostAge: 300000,
        priorityBoostFactor: 1.5,
        loadSheddingThreshold: 0.9,
      });
    });

    it('should optimize concurrency based on queue metrics', () => {
      // Simulate high throughput, low latency scenario
      const highThroughputMetrics = {
        timestamp: new Date(),
        queueSize: 100,
        processingCount: 5,
        completedCount: 50,
        failedCount: 2,
        averageLatency: 100,
        averageProcessingTime: 200,
        throughput: 20,
        errorRate: 0.04,
      };
      
      const optimizedConcurrency = service.optimizeConcurrency(highThroughputMetrics);
      
      // Should increase concurrency due to high throughput and low latency
      expect(optimizedConcurrency).toBeGreaterThan(service.getOptimizationConfig().minConcurrency);
      
      // Simulate high latency, high error rate scenario
      const highLatencyMetrics = {
        timestamp: new Date(),
        queueSize: 100,
        processingCount: 8,
        completedCount: 10,
        failedCount: 5,
        averageLatency: 5000,
        averageProcessingTime: 6000,
        throughput: 5,
        errorRate: 0.3,
      };
      
      const reducedConcurrency = service.optimizeConcurrency(highLatencyMetrics);
      
      // Should decrease concurrency due to high latency and error rate
      expect(reducedConcurrency).toBeLessThan(optimizedConcurrency);
    });
  });

  describe('Timeout Optimization', () => {
    beforeEach(() => {
      service.setOptimizationConfig({
        enabled: true,
        strategies: [OptimizationStrategy.ADAPTIVE_TIMEOUT],
        minConcurrency: 1,
        maxConcurrency: 10,
        batchSize: 1,
        adaptiveTimeoutEnabled: true,
        minTimeout: 1000,
        maxTimeout: 30000,
        priorityBoostAge: 300000,
        priorityBoostFactor: 1.5,
        loadSheddingThreshold: 0.9,
      });
    });

    it('should optimize timeouts based on processing times', () => {
      // Simulate job completion with processing times
      const processingTimes = [1500, 1600, 1550, 1700, 1650];
      
      processingTimes.forEach(time => {
        service.trackJobCompletion({
          id: `job-${time}`,
          name: 'test-job',
          data: {},
          priority: 5,
          createdAt: new Date(Date.now() - time),
          scheduledFor: null,
          attempts: 1,
          maxAttempts: 3,
          lastError: null,
          lastAttemptedAt: new Date(),
          status: JobStatus.COMPLETED,
          options: {},
        }, time);
      });
      
      const optimizedTimeout = service.optimizeTimeout('test-job');
      
      // Should set timeout based on processing times plus buffer
      expect(optimizedTimeout).toBeGreaterThan(1700); // Greater than max processing time
      expect(optimizedTimeout).toBeLessThan(service.getOptimizationConfig().maxTimeout);
    });

    it('should return default timeout for unknown job types', () => {
      const timeout = service.optimizeTimeout('unknown-job');
      
      // Should return a default timeout
      expect(timeout).toBeGreaterThanOrEqual(service.getOptimizationConfig().minTimeout);
    });
  });

  describe('Priority Boosting', () => {
    beforeEach(() => {
      service.setOptimizationConfig({
        enabled: true,
        strategies: [OptimizationStrategy.PRIORITY_BOOSTING],
        minConcurrency: 1,
        maxConcurrency: 10,
        batchSize: 1,
        adaptiveTimeoutEnabled: false,
        minTimeout: 1000,
        maxTimeout: 30000,
        priorityBoostAge: 10000, // 10 seconds for testing
        priorityBoostFactor: 2.0,
        loadSheddingThreshold: 0.9,
      });
    });

    it('should boost priority of old jobs', () => {
      const now = Date.now();
      
      // Create a recent job
      const recentJob = {
        id: '1',
        name: 'recent-job',
        data: {},
        priority: 5,
        createdAt: new Date(now - 5000), // 5 seconds ago
        scheduledFor: null,
        attempts: 0,
        maxAttempts: 3,
        lastError: null,
        lastAttemptedAt: null,
        status: JobStatus.PENDING,
        options: {},
      };
      
      // Create an old job
      const oldJob = {
        id: '2',
        name: 'old-job',
        data: {},
        priority: 5,
        createdAt: new Date(now - 20000), // 20 seconds ago (older than priorityBoostAge)
        scheduledFor: null,
        attempts: 0,
        maxAttempts: 3,
        lastError: null,
        lastAttemptedAt: null,
        status: JobStatus.PENDING,
        options: {},
      };
      
      // Boost jobs
      const boostedRecentJob = service.boostJobPriority(recentJob);
      const boostedOldJob = service.boostJobPriority(oldJob);
      
      // Recent job should not be boosted
      expect(boostedRecentJob.priority).toBe(5);
      
      // Old job should be boosted
      expect(boostedOldJob.priority).toBe(10); // 5 * 2.0
    });
  });

  describe('Load Shedding', () => {
    beforeEach(() => {
      service.setOptimizationConfig({
        enabled: true,
        strategies: [OptimizationStrategy.LOAD_SHEDDING],
        minConcurrency: 1,
        maxConcurrency: 10,
        batchSize: 1,
        adaptiveTimeoutEnabled: false,
        minTimeout: 1000,
        maxTimeout: 30000,
        priorityBoostAge: 300000,
        priorityBoostFactor: 1.5,
        loadSheddingThreshold: 0.8, // 80% threshold
      });
    });

    it('should perform load shedding when system is overloaded', () => {
      // Simulate system metrics indicating overload
      const overloadMetrics = {
        cpuUsage: 0.9, // 90% CPU usage
        memoryUsage: 0.85, // 85% memory usage
        queueGrowthRate: 2.0, // Queue growing rapidly
      };
      
      const shouldShed = service.shouldPerformLoadShedding(overloadMetrics);
      
      // Should recommend load shedding
      expect(shouldShed).toBe(true);
    });

    it('should not perform load shedding when system load is normal', () => {
      // Simulate normal system metrics
      const normalMetrics = {
        cpuUsage: 0.5, // 50% CPU usage
        memoryUsage: 0.6, // 60% memory usage
        queueGrowthRate: 0.5, // Queue growing slowly
      };
      
      const shouldShed = service.shouldPerformLoadShedding(normalMetrics);
      
      // Should not recommend load shedding
      expect(shouldShed).toBe(false);
    });
  });

  describe('Batching', () => {
    beforeEach(() => {
      service.setOptimizationConfig({
        enabled: true,
        strategies: [OptimizationStrategy.BATCHING],
        minConcurrency: 1,
        maxConcurrency: 10,
        batchSize: 3, // Process 3 jobs at a time
        adaptiveTimeoutEnabled: false,
        minTimeout: 1000,
        maxTimeout: 30000,
        priorityBoostAge: 300000,
        priorityBoostFactor: 1.5,
        loadSheddingThreshold: 0.9,
      });
    });

    it('should batch jobs for processing', () => {
      // Create test jobs
      const jobs = [
        {
          id: '1',
          name: 'job1',
          data: { value: 1 },
          priority: 5,
          createdAt: new Date(),
          scheduledFor: null,
          attempts: 0,
          maxAttempts: 3,
          lastError: null,
          lastAttemptedAt: null,
          status: JobStatus.PENDING,
          options: {},
        },
        {
          id: '2',
          name: 'job2',
          data: { value: 2 },
          priority: 5,
          createdAt: new Date(),
          scheduledFor: null,
          attempts: 0,
          maxAttempts: 3,
          lastError: null,
          lastAttemptedAt: null,
          status: JobStatus.PENDING,
          options: {},
        },
        {
          id: '3',
          name: 'job3',
          data: { value: 3 },
          priority: 5,
          createdAt: new Date(),
          scheduledFor: null,
          attempts: 0,
          maxAttempts: 3,
          lastError: null,
          lastAttemptedAt: null,
          status: JobStatus.PENDING,
          options: {},
        },
        {
          id: '4',
          name: 'job4',
          data: { value: 4 },
          priority: 5,
          createdAt: new Date(),
          scheduledFor: null,
          attempts: 0,
          maxAttempts: 3,
          lastError: null,
          lastAttemptedAt: null,
          status: JobStatus.PENDING,
          options: {},
        },
      ];
      
      // Process jobs with batching
      const batches = service.createJobBatches(jobs);
      
      // Should create batches of size 3 (as configured)
      expect(batches.length).toBe(2);
      expect(batches[0].length).toBe(3); // First batch has 3 jobs
      expect(batches[1].length).toBe(1); // Second batch has 1 job
    });

    it('should optimize batch size based on metrics', () => {
      // Simulate metrics with good throughput
      const goodMetrics = {
        timestamp: new Date(),
        queueSize: 100,
        processingCount: 10,
        completedCount: 50,
        failedCount: 2,
        averageLatency: 100,
        averageProcessingTime: 200,
        throughput: 25,
        errorRate: 0.04,
      };
      
      const optimizedBatchSize = service.optimizeBatchSize(goodMetrics);
      
      // Should increase batch size due to good throughput
      expect(optimizedBatchSize).toBeGreaterThan(service.getOptimizationConfig().batchSize);
    });
  });

  describe('Optimization Statistics', () => {
    it('should track and retrieve optimization statistics', () => {
      // Simulate some optimizations
      service['optimizationStats'] = {
        concurrencyAdjustments: 10,
        timeoutAdjustments: 5,
        priorityBoosts: 20,
        loadSheddingEvents: 2,
        batchSizeAdjustments: 8,
        totalJobsOptimized: 100,
        optimizationRunTime: 500,
      };
      
      const stats = service.getOptimizationStats();
      
      expect(stats).toBeDefined();
      expect(stats.concurrencyAdjustments).toBe(10);
      expect(stats.timeoutAdjustments).toBe(5);
      expect(stats.priorityBoosts).toBe(20);
      expect(stats.loadSheddingEvents).toBe(2);
      expect(stats.batchSizeAdjustments).toBe(8);
      expect(stats.totalJobsOptimized).toBe(100);
      expect(stats.optimizationRunTime).toBe(500);
    });
  });
});