import { Test, TestingModule } from '@nestjs/testing';
import { JobSchedulerService } from '../scheduler/job-scheduler.service';
import { JobStatus } from '../interfaces/job.interface';

describe('JobSchedulerService', () => {
  let service: JobSchedulerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JobSchedulerService],
    }).compile();

    service = module.get<JobSchedulerService>(JobSchedulerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Scheduler Control', () => {
    it('should start and stop the scheduler', () => {
      // Start scheduler
      service.startScheduler();
      expect(service.isRunning()).toBe(true);
      
      // Stop scheduler
      service.stopScheduler();
      expect(service.isRunning()).toBe(false);
    });
  });

  describe('One-time Job Scheduling', () => {
    it('should schedule a one-time job', async () => {
      const scheduledTime = new Date(Date.now() + 60000); // 1 minute in the future
      
      const job = await service.scheduleJob({
        name: 'scheduled-test',
        data: { test: 'data' },
        scheduledFor: scheduledTime,
      });
      
      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.name).toBe('scheduled-test');
      expect(job.data).toEqual({ test: 'data' });
      expect(job.scheduledFor).toEqual(scheduledTime);
      expect(job.status).toBe(JobStatus.PENDING);
    });

    it('should execute a scheduled job when its time arrives', async () => {
      // Create a spy on the executeJob method
      const executeJobSpy = jest.spyOn(service, 'executeJob');
      
      // Schedule a job for immediate execution
      const job = await service.scheduleJob({
        name: 'immediate-test',
        data: { test: 'data' },
        scheduledFor: new Date(),
      });
      
      // Manually trigger the check for due jobs
      await service['checkScheduledJobs']();
      
      // The job should have been executed
      expect(executeJobSpy).toHaveBeenCalledWith(expect.objectContaining({
        id: job.id,
      }));
    });
  });

  describe('Recurring Job Management', () => {
    it('should add a recurring job', () => {
      const recurringJob = service.addRecurringJob({
        name: 'recurring-test',
        data: { test: 'data' },
        cronExpression: '0 * * * *', // Every hour
        enabled: true,
      });
      
      expect(recurringJob).toBeDefined();
      expect(recurringJob.id).toBeDefined();
      expect(recurringJob.name).toBe('recurring-test');
      expect(recurringJob.data).toEqual({ test: 'data' });
      expect(recurringJob.cronExpression).toBe('0 * * * *');
      expect(recurringJob.enabled).toBe(true);
    });

    it('should get a recurring job by id', () => {
      const addedJob = service.addRecurringJob({
        name: 'get-test',
        data: {},
        cronExpression: '0 0 * * *', // Daily at midnight
        enabled: true,
      });
      
      const retrievedJob = service.getRecurringJob(addedJob.id);
      
      expect(retrievedJob).toBeDefined();
      expect(retrievedJob?.id).toBe(addedJob.id);
    });

    it('should return null when getting a non-existent recurring job', () => {
      const job = service.getRecurringJob('non-existent-id');
      expect(job).toBeNull();
    });

    it('should get all recurring jobs', () => {
      // Add some recurring jobs
      service.addRecurringJob({
        name: 'job1',
        data: {},
        cronExpression: '0 0 * * *',
        enabled: true,
      });
      
      service.addRecurringJob({
        name: 'job2',
        data: {},
        cronExpression: '0 12 * * *',
        enabled: false,
      });
      
      const jobs = service.getAllRecurringJobs();
      
      expect(jobs).toBeDefined();
      expect(jobs.length).toBeGreaterThanOrEqual(2);
    });

    it('should update a recurring job', () => {
      const job = service.addRecurringJob({
        name: 'update-test',
        data: {},
        cronExpression: '0 0 * * *',
        enabled: true,
      });
      
      const updatedJob = service.updateRecurringJob(job.id, {
        name: 'updated-job',
        data: { updated: true },
        cronExpression: '0 12 * * *',
        enabled: false,
      });
      
      expect(updatedJob).toBeDefined();
      expect(updatedJob?.id).toBe(job.id);
      expect(updatedJob?.name).toBe('updated-job');
      expect(updatedJob?.data).toEqual({ updated: true });
      expect(updatedJob?.cronExpression).toBe('0 12 * * *');
      expect(updatedJob?.enabled).toBe(false);
    });

    it('should return null when updating a non-existent recurring job', () => {
      const result = service.updateRecurringJob('non-existent-id', {
        name: 'updated-job',
        data: {},
        cronExpression: '0 0 * * *',
        enabled: true,
      });
      
      expect(result).toBeNull();
    });

    it('should remove a recurring job', () => {
      const job = service.addRecurringJob({
        name: 'remove-test',
        data: {},
        cronExpression: '0 0 * * *',
        enabled: true,
      });
      
      const removed = service.removeRecurringJob(job.id);
      const retrievedJob = service.getRecurringJob(job.id);
      
      expect(removed).toBe(true);
      expect(retrievedJob).toBeNull();
    });

    it('should return false when removing a non-existent recurring job', () => {
      const result = service.removeRecurringJob('non-existent-id');
      expect(result).toBe(false);
    });

    it('should enable and disable a recurring job', () => {
      const job = service.addRecurringJob({
        name: 'enable-disable-test',
        data: {},
        cronExpression: '0 0 * * *',
        enabled: false,
      });
      
      // Enable the job
      const enabled = service.enableRecurringJob(job.id);
      expect(enabled).toBeDefined();
      expect(enabled?.enabled).toBe(true);
      
      // Disable the job
      const disabled = service.disableRecurringJob(job.id);
      expect(disabled).toBeDefined();
      expect(disabled?.enabled).toBe(false);
    });
  });

  describe('Cron Expression Handling', () => {
    it('should validate a valid cron expression', () => {
      const validExpressions = [
        '* * * * *',        // Every minute
        '0 * * * *',        // Every hour
        '0 0 * * *',        // Every day at midnight
        '0 0 * * 0',        // Every Sunday at midnight
        '0 0 1 * *',        // First day of month at midnight
        '0 0 1 1 *',        // January 1st at midnight
        '30 3 * * 1-5',     // 3:30 AM on weekdays
      ];
      
      validExpressions.forEach(expr => {
        expect(service['validateCronExpression'](expr)).toBe(true);
      });
    });

    it('should reject an invalid cron expression', () => {
      const invalidExpressions = [
        '',                 // Empty
        '* * *',            // Too few fields
        '* * * * * *',      // Too many fields
        '60 * * * *',       // Invalid minute
        '* 24 * * *',       // Invalid hour
        '* * 32 * *',       // Invalid day
        '* * * 13 *',       // Invalid month
        '* * * * 7',        // Invalid day of week
        'a * * * *',        // Non-numeric
      ];
      
      invalidExpressions.forEach(expr => {
        expect(service['validateCronExpression'](expr)).toBe(false);
      });
    });

    it('should calculate the next execution time for a cron expression', () => {
      const now = new Date();
      
      // Test hourly cron (should be next hour)
      const hourlyNext = service['getNextExecutionTime']('0 * * * *');
      expect(hourlyNext).toBeInstanceOf(Date);
      expect(hourlyNext.getMinutes()).toBe(0);
      expect(hourlyNext > now).toBe(true);
      
      // Test daily cron (should be next day at midnight)
      const dailyNext = service['getNextExecutionTime']('0 0 * * *');
      expect(dailyNext).toBeInstanceOf(Date);
      expect(dailyNext.getHours()).toBe(0);
      expect(dailyNext.getMinutes()).toBe(0);
      expect(dailyNext > now).toBe(true);
    });
  });
});