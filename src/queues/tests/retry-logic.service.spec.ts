import { Test, TestingModule } from '@nestjs/testing';
import { RetryLogicService, RetryStrategy } from '../retry/retry-logic.service';
import { Job, JobStatus } from '../interfaces/job.interface';

describe('RetryLogicService', () => {
  let service: RetryLogicService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RetryLogicService],
    }).compile();

    service = module.get<RetryLogicService>(RetryLogicService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Retry Configuration', () => {
    it('should set and get retry configuration', () => {
      const config = {
        defaultMaxAttempts: 5,
        defaultStrategy: RetryStrategy.EXPONENTIAL,
        defaultInitialBackoff: 1000,
        defaultMaxBackoff: 30000,
        errorTypeRetryMapping: {
          'ConnectionError': 10,
          'ValidationError': 0,
        },
      };

      service.setRetryConfig(config);
      const retrievedConfig = service.getRetryConfig();

      expect(retrievedConfig).toEqual(config);
    });

    it('should have default configuration', () => {
      const config = service.getRetryConfig();
      
      expect(config).toBeDefined();
      expect(config.defaultMaxAttempts).toBeDefined();
      expect(config.defaultStrategy).toBeDefined();
      expect(config.defaultInitialBackoff).toBeDefined();
      expect(config.defaultMaxBackoff).toBeDefined();
    });
  });

  describe('Retry Handling', () => {
    // Helper function to create a test job
    const createTestJob = (id: string, attempts = 0, maxAttempts = 3, error = null): Job => ({
      id,
      name: `test-job-${id}`,
      data: {},
      priority: 5,
      createdAt: new Date(),
      scheduledFor: null,
      attempts,
      maxAttempts,
      lastError: error,
      lastAttemptedAt: attempts > 0 ? new Date() : null,
      status: JobStatus.FAILED,
      options: {},
    });

    it('should handle a failed job with retries remaining', () => {
      const job = createTestJob('1', 1, 3, 'Test error');
      
      const result = service.handleFailedJob(job, 'Test error');
      
      expect(result).toBeDefined();
      expect(result.shouldRetry).toBe(true);
      expect(result.updatedJob).toBeDefined();
      expect(result.updatedJob.attempts).toBe(2);
      expect(result.updatedJob.lastError).toBe('Test error');
      expect(result.updatedJob.lastAttemptedAt).toBeDefined();
      expect(result.updatedJob.status).toBe(JobStatus.PENDING);
      expect(result.nextRetryDelay).toBeGreaterThan(0);
    });

    it('should handle a failed job with no retries remaining', () => {
      const job = createTestJob('2', 3, 3, 'Test error');
      
      const result = service.handleFailedJob(job, 'Final error');
      
      expect(result).toBeDefined();
      expect(result.shouldRetry).toBe(false);
      expect(result.updatedJob).toBeDefined();
      expect(result.updatedJob.attempts).toBe(3); // Should not increment
      expect(result.updatedJob.lastError).toBe('Final error');
      expect(result.updatedJob.status).toBe(JobStatus.FAILED);
      expect(result.nextRetryDelay).toBe(0);
    });

    it('should handle a failed job with specific error type retry mapping', () => {
      // Set up config with error type mapping
      service.setRetryConfig({
        defaultMaxAttempts: 3,
        defaultStrategy: RetryStrategy.FIXED,
        defaultInitialBackoff: 1000,
        defaultMaxBackoff: 30000,
        errorTypeRetryMapping: {
          'ConnectionError': 5, // Allow more retries for connection errors
          'ValidationError': 0, // No retries for validation errors
        },
      });
      
      // Test with connection error
      const job1 = createTestJob('3', 3, 3, 'Previous error');
      const result1 = service.handleFailedJob(job1, 'ConnectionError: Failed to connect');
      
      // Should allow retry despite reaching default max attempts
      expect(result1.shouldRetry).toBe(true);
      
      // Test with validation error
      const job2 = createTestJob('4', 1, 3, 'Previous error');
      const result2 = service.handleFailedJob(job2, 'ValidationError: Invalid input');
      
      // Should not retry validation errors
      expect(result2.shouldRetry).toBe(false);
    });
  });

  describe('Backoff Calculation', () => {
    it('should calculate fixed backoff delay', () => {
      service.setRetryConfig({
        defaultMaxAttempts: 3,
        defaultStrategy: RetryStrategy.FIXED,
        defaultInitialBackoff: 1000,
        defaultMaxBackoff: 30000,
      });
      
      const delay1 = service.calculateRetryDelay(1);
      const delay2 = service.calculateRetryDelay(2);
      
      // Fixed strategy should return the same delay regardless of attempt number
      expect(delay1).toBe(1000);
      expect(delay2).toBe(1000);
    });

    it('should calculate linear backoff delay', () => {
      service.setRetryConfig({
        defaultMaxAttempts: 3,
        defaultStrategy: RetryStrategy.LINEAR,
        defaultInitialBackoff: 1000,
        defaultMaxBackoff: 30000,
      });
      
      const delay1 = service.calculateRetryDelay(1);
      const delay2 = service.calculateRetryDelay(2);
      
      // Linear strategy should increase delay linearly with attempt number
      expect(delay1).toBe(1000);
      expect(delay2).toBe(2000);
    });

    it('should calculate exponential backoff delay', () => {
      service.setRetryConfig({
        defaultMaxAttempts: 3,
        defaultStrategy: RetryStrategy.EXPONENTIAL,
        defaultInitialBackoff: 1000,
        defaultMaxBackoff: 30000,
      });
      
      const delay1 = service.calculateRetryDelay(1);
      const delay2 = service.calculateRetryDelay(2);
      
      // Exponential strategy should increase delay exponentially with attempt number
      expect(delay1).toBe(1000);
      expect(delay2).toBe(2000); // 1000 * 2^1
      expect(service.calculateRetryDelay(3)).toBe(4000); // 1000 * 2^2
    });

    it('should calculate fibonacci backoff delay', () => {
      service.setRetryConfig({
        defaultMaxAttempts: 5,
        defaultStrategy: RetryStrategy.FIBONACCI,
        defaultInitialBackoff: 1000,
        defaultMaxBackoff: 30000,
      });
      
      // Fibonacci sequence: 1, 1, 2, 3, 5, 8, 13, ...
      expect(service.calculateRetryDelay(1)).toBe(1000); // 1000 * 1
      expect(service.calculateRetryDelay(2)).toBe(1000); // 1000 * 1
      expect(service.calculateRetryDelay(3)).toBe(2000); // 1000 * 2
      expect(service.calculateRetryDelay(4)).toBe(3000); // 1000 * 3
      expect(service.calculateRetryDelay(5)).toBe(5000); // 1000 * 5
    });

    it('should respect max backoff limit', () => {
      service.setRetryConfig({
        defaultMaxAttempts: 10,
        defaultStrategy: RetryStrategy.EXPONENTIAL,
        defaultInitialBackoff: 1000,
        defaultMaxBackoff: 5000,
      });
      
      // At attempt 6, the exponential delay would be 1000 * 2^5 = 32000, but should be capped at 5000
      expect(service.calculateRetryDelay(6)).toBe(5000);
    });
  });

  describe('Retry Pattern Analysis', () => {
    it('should analyze retry patterns', () => {
      // Create a history of retried jobs
      const retryHistory = [
        { jobName: 'email-send', errorType: 'ConnectionError', attempts: 3, succeeded: true },
        { jobName: 'email-send', errorType: 'ConnectionError', attempts: 2, succeeded: true },
        { jobName: 'data-process', errorType: 'ValidationError', attempts: 1, succeeded: false },
        { jobName: 'email-send', errorType: 'ConnectionError', attempts: 4, succeeded: true },
      ];
      
      // Set the retry history
      service['retryHistory'] = retryHistory;
      
      // Analyze patterns
      const recommendations = service.analyzeRetryPatterns();
      
      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
      
      // Should recommend something about ConnectionError retries
      const connectionErrorRec = recommendations.find(r => 
        r.includes('ConnectionError') || r.includes('email-send'));
      expect(connectionErrorRec).toBeDefined();
    });

    it('should track retry history', () => {
      const job = {
        id: '1',
        name: 'test-job',
        data: {},
        priority: 5,
        createdAt: new Date(),
        scheduledFor: null,
        attempts: 2,
        maxAttempts: 3,
        lastError: 'TestError: Something went wrong',
        lastAttemptedAt: new Date(),
        status: JobStatus.COMPLETED, // Job eventually succeeded
        options: {},
      };
      
      // Track the job
      service.trackJobRetryResult(job, true);
      
      // Check that it was added to history
      expect(service['retryHistory'].length).toBeGreaterThan(0);
      
      const lastEntry = service['retryHistory'][service['retryHistory'].length - 1];
      expect(lastEntry.jobName).toBe('test-job');
      expect(lastEntry.errorType).toBe('TestError');
      expect(lastEntry.attempts).toBe(2);
      expect(lastEntry.succeeded).toBe(true);
    });
  });
});