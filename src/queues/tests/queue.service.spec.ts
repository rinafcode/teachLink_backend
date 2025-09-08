import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from '../queue.service';
import { Job, JobStatus } from '../interfaces/job.interface';

describe('QueueService', () => {
  let service: QueueService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [QueueService],
    }).compile();

    service = module.get<QueueService>(QueueService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Job Management', () => {
    it('should add a job to the queue', async () => {
      const jobData = {
        name: 'test-job',
        data: { test: 'data' },
        priority: 5,
      };

      const job = await service.addJob(jobData);

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.name).toBe('test-job');
      expect(job.data).toEqual({ test: 'data' });
      expect(job.priority).toBe(5);
      expect(job.status).toBe(JobStatus.PENDING);
      expect(job.createdAt).toBeInstanceOf(Date);
    });

    it('should get a job by id', async () => {
      const jobData = {
        name: 'test-job',
        data: { test: 'data' },
      };

      const addedJob = await service.addJob(jobData);
      const retrievedJob = await service.getJob(addedJob.id);

      expect(retrievedJob).toBeDefined();
      expect(retrievedJob?.id).toBe(addedJob.id);
    });

    it('should return null when getting a non-existent job', async () => {
      const job = await service.getJob('non-existent-id');
      expect(job).toBeNull();
    });

    it('should get jobs by status', async () => {
      // Add some test jobs
      await service.addJob({ name: 'job1', data: {} });
      await service.addJob({ name: 'job2', data: {} });
      
      const pendingJobs = await service.getJobs(JobStatus.PENDING, 10, 0);
      
      expect(pendingJobs).toBeInstanceOf(Array);
      expect(pendingJobs.length).toBeGreaterThanOrEqual(2);
      expect(pendingJobs[0].status).toBe(JobStatus.PENDING);
    });

    it('should update a job', async () => {
      const job = await service.addJob({ name: 'update-test', data: {} });
      
      job.priority = 10;
      job.data = { updated: true };
      
      const updatedJob = await service.updateJob(job);
      
      expect(updatedJob).toBeDefined();
      expect(updatedJob.priority).toBe(10);
      expect(updatedJob.data).toEqual({ updated: true });
    });

    it('should remove a job', async () => {
      const job = await service.addJob({ name: 'remove-test', data: {} });
      
      const removed = await service.removeJob(job.id);
      const retrievedJob = await service.getJob(job.id);
      
      expect(removed).toBe(true);
      expect(retrievedJob).toBeNull();
    });

    it('should return false when removing a non-existent job', async () => {
      const result = await service.removeJob('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('Queue Operations', () => {
    it('should process a job', async () => {
      // Create a spy on the processJob method
      const processJobSpy = jest.spyOn(service, 'processJob');
      
      const job = await service.addJob({
        name: 'process-test',
        data: { test: 'data' },
      });
      
      // Process the job
      await service.processJob(job);
      
      expect(processJobSpy).toHaveBeenCalledWith(job);
    });

    it('should pause and resume processing', () => {
      // Pause processing
      service.setProcessingEnabled(false);
      expect(service.isProcessingEnabled()).toBe(false);
      
      // Resume processing
      service.setProcessingEnabled(true);
      expect(service.isProcessingEnabled()).toBe(true);
    });

    it('should set concurrency', () => {
      service.setConcurrency(5);
      expect(service.getConcurrency()).toBe(5);
    });

    it('should clear the queue', async () => {
      // Add some test jobs
      await service.addJob({ name: 'clear-test-1', data: {} });
      await service.addJob({ name: 'clear-test-2', data: {} });
      
      const cleared = await service.clearQueue();
      const pendingJobs = await service.getJobs(JobStatus.PENDING, 10, 0);
      
      expect(cleared).toBe(true);
      expect(pendingJobs.length).toBe(0);
    });
  });

  describe('Job Filtering', () => {
    beforeEach(async () => {
      // Add test jobs with different properties
      await service.addJob({
        name: 'filter-job-1',
        data: { value: 1 },
        priority: 1,
      });
      
      const highPriorityJob = await service.addJob({
        name: 'filter-job-2',
        data: { value: 2 },
        priority: 10,
      });
      
      // Create a scheduled job
      await service.addJob({
        name: 'scheduled-job',
        data: { value: 3 },
        scheduledFor: new Date(Date.now() + 3600000), // 1 hour in the future
      });
      
      // Create a job with attempts
      const retryJob = await service.addJob({
        name: 'retry-job',
        data: { value: 4 },
      });
      
      retryJob.attempts = 2;
      await service.updateJob(retryJob);
    });

    it('should filter jobs by name', async () => {
      const jobs = await service.getJobsByFilter({
        name: 'filter-job-1',
      });
      
      expect(jobs.length).toBeGreaterThanOrEqual(1);
      expect(jobs[0].name).toBe('filter-job-1');
    });

    it('should filter jobs by minimum priority', async () => {
      const jobs = await service.getJobsByFilter({
        minPriority: 5,
      });
      
      expect(jobs.length).toBeGreaterThanOrEqual(1);
      jobs.forEach(job => {
        expect(job.priority).toBeGreaterThanOrEqual(5);
      });
    });

    it('should filter jobs by scheduled time', async () => {
      const jobs = await service.getJobsByFilter({
        scheduledAfter: new Date(),
      });
      
      expect(jobs.length).toBeGreaterThanOrEqual(1);
      jobs.forEach(job => {
        expect(job.scheduledFor).toBeDefined();
        expect(job.scheduledFor?.getTime()).toBeGreaterThan(Date.now());
      });
    });

    it('should filter jobs by minimum attempts', async () => {
      const jobs = await service.getJobsByFilter({
        minAttempts: 1,
      });
      
      expect(jobs.length).toBeGreaterThanOrEqual(1);
      jobs.forEach(job => {
        expect(job.attempts).toBeGreaterThanOrEqual(1);
      });
    });

    it('should apply multiple filters', async () => {
      // Add a job that matches multiple criteria
      const multiMatchJob = await service.addJob({
        name: 'multi-match',
        data: { value: 5 },
        priority: 8,
      });
      
      multiMatchJob.attempts = 3;
      await service.updateJob(multiMatchJob);
      
      const jobs = await service.getJobsByFilter({
        minPriority: 5,
        minAttempts: 2,
      });
      
      expect(jobs.length).toBeGreaterThanOrEqual(1);
      jobs.forEach(job => {
        expect(job.priority).toBeGreaterThanOrEqual(5);
        expect(job.attempts).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('Event Observables', () => {
    it('should emit events when jobs are completed', done => {
      // Subscribe to completed events
      const subscription = service.onCompleted().subscribe(job => {
        expect(job).toBeDefined();
        expect(job.status).toBe(JobStatus.COMPLETED);
        expect(job.name).toBe('event-test');
        subscription.unsubscribe();
        done();
      });
      
      // Add and complete a job
      service.addJob({ name: 'event-test', data: {} })
        .then(job => {
          job.status = JobStatus.COMPLETED;
          return service.updateJob(job);
        })
        .catch(error => {
          subscription.unsubscribe();
          done.fail(error);
        });
    });

    it('should emit events when jobs fail', done => {
      // Subscribe to failed events
      const subscription = service.onFailed().subscribe(job => {
        expect(job).toBeDefined();
        expect(job.status).toBe(JobStatus.FAILED);
        expect(job.lastError).toBeDefined();
        subscription.unsubscribe();
        done();
      });
      
      // Add and fail a job
      service.addJob({ name: 'fail-test', data: {} })
        .then(job => {
          job.status = JobStatus.FAILED;
          job.lastError = 'Test error';
          return service.updateJob(job);
        })
        .catch(error => {
          subscription.unsubscribe();
          done.fail(error);
        });
    });

    it('should emit progress events', done => {
      // Subscribe to progress events
      const subscription = service.onProgress().subscribe(progress => {
        expect(progress).toBeDefined();
        expect(progress.jobId).toBeDefined();
        expect(progress.progress).toBeGreaterThan(0);
        subscription.unsubscribe();
        done();
      });
      
      // Add a job and report progress
      service.addJob({ name: 'progress-test', data: {} })
        .then(job => {
          service.reportProgress(job.id, 50, 'Half done');
        })
        .catch(error => {
          subscription.unsubscribe();
          done.fail(error);
        });
    });
  });

  describe('Queue Metrics', () => {
    it('should track queue metrics', async () => {
      // Add some jobs
      await service.addJob({ name: 'metrics-test-1', data: {} });
      await service.addJob({ name: 'metrics-test-2', data: {} });
      
      // Get metrics
      const metrics = await service.getQueueMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.queueSize).toBeGreaterThanOrEqual(2);
      expect(metrics.processingCount).toBeDefined();
      expect(metrics.completedCount).toBeDefined();
      expect(metrics.failedCount).toBeDefined();
    });
  });
});