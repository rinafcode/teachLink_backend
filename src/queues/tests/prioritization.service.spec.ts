import { Test, TestingModule } from '@nestjs/testing';
import { PrioritizationService, PriorityStrategy } from '../prioritization/prioritization.service';
import { Job, JobStatus } from '../interfaces/job.interface';

describe('PrioritizationService', () => {
  let service: PrioritizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrioritizationService],
    }).compile();

    service = module.get<PrioritizationService>(PrioritizationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Priority Configuration', () => {
    it('should set and get priority configuration', () => {
      const config = {
        strategy: PriorityStrategy.PRIORITY,
        weights: {
          priority: 1.0,
          age: 0.5,
          attempts: 0.2,
        },
      };

      service.setPriorityConfig(config);
      const retrievedConfig = service.getPriorityConfig();

      expect(retrievedConfig).toEqual(config);
    });

    it('should have default configuration', () => {
      const config = service.getPriorityConfig();
      
      expect(config).toBeDefined();
      expect(config.strategy).toBeDefined();
      expect(config.weights).toBeDefined();
    });
  });

  describe('Priority Calculation', () => {
    // Helper function to create test jobs
    const createTestJob = (id: string, priority: number, createdAt: Date, attempts = 0): Job => ({
      id,
      name: `test-job-${id}`,
      data: {},
      priority,
      createdAt,
      scheduledFor: null,
      attempts,
      maxAttempts: 3,
      lastError: null,
      lastAttemptedAt: null,
      status: JobStatus.PENDING,
      options: {},
    });

    it('should calculate priority score based on FIFO strategy', () => {
      service.setPriorityConfig({ strategy: PriorityStrategy.FIFO, weights: {} });
      
      const job1 = createTestJob('1', 5, new Date(Date.now() - 1000)); // 1 second ago
      const job2 = createTestJob('2', 10, new Date(Date.now() - 2000)); // 2 seconds ago
      
      const score1 = service.calculatePriorityScore(job1);
      const score2 = service.calculatePriorityScore(job2);
      
      // In FIFO, older jobs (job2) should have higher priority
      expect(score2).toBeGreaterThan(score1);
    });

    it('should calculate priority score based on LIFO strategy', () => {
      service.setPriorityConfig({ strategy: PriorityStrategy.LIFO, weights: {} });
      
      const job1 = createTestJob('1', 5, new Date(Date.now() - 1000)); // 1 second ago
      const job2 = createTestJob('2', 10, new Date(Date.now() - 2000)); // 2 seconds ago
      
      const score1 = service.calculatePriorityScore(job1);
      const score2 = service.calculatePriorityScore(job2);
      
      // In LIFO, newer jobs (job1) should have higher priority
      expect(score1).toBeGreaterThan(score2);
    });

    it('should calculate priority score based on PRIORITY strategy', () => {
      service.setPriorityConfig({ strategy: PriorityStrategy.PRIORITY, weights: {} });
      
      const job1 = createTestJob('1', 5, new Date());
      const job2 = createTestJob('2', 10, new Date());
      
      const score1 = service.calculatePriorityScore(job1);
      const score2 = service.calculatePriorityScore(job2);
      
      // In PRIORITY, higher priority value (job2) should have higher score
      expect(score2).toBeGreaterThan(score1);
    });

    it('should calculate priority score based on DEADLINE strategy', () => {
      service.setPriorityConfig({ strategy: PriorityStrategy.DEADLINE, weights: {} });
      
      const now = Date.now();
      const job1 = createTestJob('1', 5, new Date());
      const job2 = createTestJob('2', 5, new Date());
      
      // Set scheduled times (deadlines)
      job1.scheduledFor = new Date(now + 60000); // 1 minute from now
      job2.scheduledFor = new Date(now + 30000); // 30 seconds from now
      
      const score1 = service.calculatePriorityScore(job1);
      const score2 = service.calculatePriorityScore(job2);
      
      // In DEADLINE, jobs with closer deadlines (job2) should have higher priority
      expect(score2).toBeGreaterThan(score1);
    });

    it('should calculate priority score based on WEIGHTED strategy', () => {
      service.setPriorityConfig({
        strategy: PriorityStrategy.WEIGHTED,
        weights: {
          priority: 0.7,
          age: 0.2,
          attempts: 0.1,
        },
      });
      
      const job1 = createTestJob('1', 10, new Date(Date.now() - 1000), 0); // High priority, newer, no attempts
      const job2 = createTestJob('2', 5, new Date(Date.now() - 10000), 2); // Lower priority, older, 2 attempts
      
      const score1 = service.calculatePriorityScore(job1);
      const score2 = service.calculatePriorityScore(job2);
      
      // With these weights, job1 should still have higher score due to priority weight
      expect(score1).toBeGreaterThan(score2);
      
      // Now change weights to favor age and attempts
      service.setPriorityConfig({
        strategy: PriorityStrategy.WEIGHTED,
        weights: {
          priority: 0.2,
          age: 0.4,
          attempts: 0.4,
        },
      });
      
      const newScore1 = service.calculatePriorityScore(job1);
      const newScore2 = service.calculatePriorityScore(job2);
      
      // Now job2 should have higher score due to age and attempts
      expect(newScore2).toBeGreaterThan(newScore1);
    });

    it('should calculate priority score based on FAIR_SHARE strategy', () => {
      service.setPriorityConfig({ strategy: PriorityStrategy.FAIR_SHARE, weights: {} });
      
      // Create jobs with different names (representing different job types)
      const job1 = createTestJob('1', 5, new Date(Date.now() - 1000));
      const job2 = createTestJob('2', 5, new Date(Date.now() - 2000));
      job1.name = 'type-A';
      job2.name = 'type-B';
      
      // Simulate processing history to favor type-B
      service['processingHistory'] = {
        'type-A': 10, // Processed 10 times
        'type-B': 2,  // Processed 2 times
      };
      
      const score1 = service.calculatePriorityScore(job1);
      const score2 = service.calculatePriorityScore(job2);
      
      // In FAIR_SHARE, job2 should have higher priority as its type has been processed less
      expect(score2).toBeGreaterThan(score1);
    });
  });

  describe('Job Ordering', () => {
    it('should get the next job based on priority score', () => {
      // Create test jobs
      const job1 = {
        id: '1',
        name: 'job1',
        data: {},
        priority: 5,
        createdAt: new Date(Date.now() - 5000),
        scheduledFor: null,
        attempts: 0,
        maxAttempts: 3,
        lastError: null,
        lastAttemptedAt: null,
        status: JobStatus.PENDING,
        options: {},
      };
      
      const job2 = {
        id: '2',
        name: 'job2',
        data: {},
        priority: 10,
        createdAt: new Date(Date.now() - 1000),
        scheduledFor: null,
        attempts: 0,
        maxAttempts: 3,
        lastError: null,
        lastAttemptedAt: null,
        status: JobStatus.PENDING,
        options: {},
      };
      
      // Set priority strategy to PRIORITY
      service.setPriorityConfig({ strategy: PriorityStrategy.PRIORITY, weights: {} });
      
      // Get next job from the list
      const nextJob = service.getNextJob([job1, job2]);
      
      // Should return job2 with higher priority
      expect(nextJob).toBeDefined();
      expect(nextJob?.id).toBe('2');
    });

    it('should return null when no jobs are available', () => {
      const nextJob = service.getNextJob([]);
      expect(nextJob).toBeNull();
    });

    it('should update job priority', () => {
      const job = {
        id: '1',
        name: 'job1',
        data: {},
        priority: 5,
        createdAt: new Date(),
        scheduledFor: null,
        attempts: 0,
        maxAttempts: 3,
        lastError: null,
        lastAttemptedAt: null,
        status: JobStatus.PENDING,
        options: {},
      };
      
      const updatedJob = service.updateJobPriority(job, 10);
      
      expect(updatedJob).toBeDefined();
      expect(updatedJob.priority).toBe(10);
    });
  });

  describe('Dynamic Weight Adjustment', () => {
    it('should adjust weights based on processing history', () => {
      // Set initial weights
      service.setPriorityConfig({
        strategy: PriorityStrategy.WEIGHTED,
        weights: {
          priority: 0.5,
          age: 0.3,
          attempts: 0.2,
        },
      });
      
      // Track some job processing
      service.trackJobProcessed({
        id: '1',
        name: 'job-type-1',
        data: {},
        priority: 10,
        createdAt: new Date(Date.now() - 10000),
        scheduledFor: null,
        attempts: 0,
        maxAttempts: 3,
        lastError: null,
        lastAttemptedAt: null,
        status: JobStatus.COMPLETED,
        options: {},
      });
      
      // Call dynamic weight adjustment
      service.adjustWeightsDynamically();
      
      // Weights should be adjusted
      const newConfig = service.getPriorityConfig();
      expect(newConfig.weights).toBeDefined();
      
      // The specific values will depend on the implementation, but they should still sum to 1
      const sum = Object.values(newConfig.weights).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 5); // Sum should be close to 1 with precision of 5 decimal places
    });
  });
});