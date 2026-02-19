# Queue Management Examples

## Basic Usage

### 1. Add a Simple Job

```bash
curl -X POST http://localhost:3000/queues/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "send-email",
    "data": {
      "to": "user@example.com",
      "subject": "Welcome to TeachLink",
      "body": "Thank you for joining!"
    }
  }'
```

Response:
```json
{
  "jobId": "1",
  "name": "send-email",
  "priority": 3,
  "status": "queued"
}
```

### 2. Add Job with Priority

```bash
curl -X POST http://localhost:3000/queues/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "process-payment",
    "data": {
      "amount": 99.99,
      "userId": "user-123",
      "orderId": "order-456"
    },
    "options": {
      "priority": 1,
      "attempts": 5,
      "timeout": 60000
    }
  }'
```

### 3. Add Job with Smart Priority Calculation

```bash
curl -X POST http://localhost:3000/queues/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "generate-report",
    "data": {
      "reportType": "monthly-sales",
      "userId": "user-123"
    },
    "priorityFactors": {
      "userTier": "premium",
      "urgency": "high",
      "businessImpact": "revenue",
      "deadline": "2024-12-31T23:59:59Z"
    }
  }'
```

## Scheduling

### 4. Schedule Job for Specific Time

```bash
curl -X POST http://localhost:3000/queues/jobs/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "name": "send-reminder",
    "data": {
      "userId": "user-123",
      "message": "Your course starts tomorrow!"
    },
    "scheduledTime": "2024-12-25T09:00:00Z"
  }'
```

### 5. Schedule Delayed Job

```bash
curl -X POST http://localhost:3000/queues/jobs/delay \
  -H "Content-Type: application/json" \
  -d '{
    "name": "cleanup-temp-files",
    "data": {
      "directory": "/tmp/uploads"
    },
    "delayMs": 3600000
  }'
```

### 6. Get Scheduled Jobs

```bash
curl http://localhost:3000/queues/jobs/scheduled
```

Response:
```json
[
  {
    "id": "5",
    "name": "send-reminder",
    "data": { "userId": "user-123" },
    "scheduledFor": "2024-12-25T09:00:00.000Z",
    "priority": 3
  }
]
```

## Monitoring

### 7. Get Queue Metrics

```bash
curl http://localhost:3000/queues/metrics
```

Response:
```json
{
  "queueName": "default",
  "waiting": 45,
  "active": 5,
  "completed": 1250,
  "failed": 12,
  "delayed": 8,
  "paused": 0,
  "total": 1320,
  "throughput": 120,
  "avgProcessingTime": 2500
}
```

### 8. Get Queue Health

```bash
curl http://localhost:3000/queues/health
```

Response:
```json
{
  "status": "healthy",
  "issues": [],
  "metrics": {
    "waiting": 45,
    "active": 5,
    "completed": 1250,
    "failed": 12
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 9. Get Queue Statistics

```bash
curl http://localhost:3000/queues/statistics
```

Response:
```json
{
  "current": {
    "queueName": "default",
    "waiting": 45,
    "active": 5,
    "throughput": 120
  },
  "trends": {
    "completed": "up",
    "failed": "stable",
    "throughput": "up"
  },
  "health": {
    "status": "healthy",
    "issues": []
  }
}
```

### 10. Get Failed Jobs

```bash
curl http://localhost:3000/queues/jobs/failed?limit=10
```

Response:
```json
[
  {
    "id": "42",
    "name": "send-email",
    "data": { "to": "user@example.com" },
    "failedReason": "SMTP connection timeout",
    "attemptsMade": 3,
    "timestamp": 1705315200000
  }
]
```

### 11. Get Stuck Jobs

```bash
curl http://localhost:3000/queues/jobs/stuck?threshold=300000
```

## Job Management

### 12. Get Job Details

```bash
curl http://localhost:3000/queues/jobs/1
```

Response:
```json
{
  "jobId": "1",
  "name": "send-email",
  "status": "completed",
  "priority": 3,
  "attempts": 1,
  "maxAttempts": 3,
  "progress": 100,
  "createdAt": "2024-01-15T10:00:00.000Z",
  "processedAt": "2024-01-15T10:00:05.000Z",
  "finishedAt": "2024-01-15T10:00:08.000Z",
  "data": { "to": "user@example.com" }
}
```

### 13. Retry Failed Job

```bash
curl -X POST http://localhost:3000/queues/jobs/42/retry
```

### 14. Remove Job

```bash
curl -X DELETE http://localhost:3000/queues/jobs/1
```

### 15. Cancel Scheduled Job

```bash
curl -X DELETE http://localhost:3000/queues/jobs/scheduled/5
```

## Queue Control

### 16. Pause Queue

```bash
curl -X POST http://localhost:3000/queues/pause
```

### 17. Resume Queue

```bash
curl -X POST http://localhost:3000/queues/resume
```

### 18. Clean Queue

```bash
curl -X POST http://localhost:3000/queues/clean \
  -H "Content-Type: application/json" \
  -d '{
    "grace": 86400000,
    "status": "completed"
  }'
```

### 19. Get Queue Counts

```bash
curl http://localhost:3000/queues/counts
```

Response:
```json
{
  "waiting": 45,
  "active": 5,
  "completed": 1250,
  "failed": 12,
  "delayed": 8,
  "paused": 0
}
```

## Bulk Operations

### 20. Add Multiple Jobs

```bash
curl -X POST http://localhost:3000/queues/jobs/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "jobs": [
      {
        "name": "send-email",
        "data": { "to": "user1@example.com" }
      },
      {
        "name": "send-email",
        "data": { "to": "user2@example.com" }
      },
      {
        "name": "send-email",
        "data": { "to": "user3@example.com" }
      }
    ]
  }'
```

Response:
```json
{
  "count": 3,
  "jobIds": ["10", "11", "12"]
}
```

## TypeScript Usage

### 21. Using QueueService

```typescript
import { Injectable } from '@nestjs/common';
import { QueueService } from './queues/queue.service';
import { JobPriority } from './queues/enums/job-priority.enum';

@Injectable()
export class EmailService {
  constructor(private readonly queueService: QueueService) {}

  async sendWelcomeEmail(email: string): Promise<void> {
    await this.queueService.addJob(
      'send-email',
      {
        to: email,
        subject: 'Welcome!',
        template: 'welcome',
      },
      {
        priority: JobPriority.HIGH,
        attempts: 3,
      },
    );
  }
}
```

### 22. Using PrioritizationService

```typescript
import { Injectable } from '@nestjs/common';
import { QueueService } from './queues/queue.service';
import { PrioritizationService } from './queues/prioritization/prioritization.service';

@Injectable()
export class PaymentService {
  constructor(
    private readonly queueService: QueueService,
    private readonly prioritizationService: PrioritizationService,
  ) {}

  async processPayment(userId: string, amount: number): Promise<void> {
    // Calculate priority based on user and payment
    const user = await this.getUserTier(userId);
    const priority = this.prioritizationService.calculatePriority({
      userTier: user.tier,
      urgency: amount > 1000 ? 'high' : 'normal',
      businessImpact: 'revenue',
    });

    const options = this.prioritizationService.getJobOptions(priority);

    await this.queueService.addJob(
      'process-payment',
      { userId, amount },
      options,
    );
  }
}
```

### 23. Using JobSchedulerService

```typescript
import { Injectable } from '@nestjs/common';
import { JobSchedulerService } from './queues/scheduler/job-scheduler.service';

@Injectable()
export class ReminderService {
  constructor(
    private readonly schedulerService: JobSchedulerService,
  ) {}

  async scheduleReminder(
    userId: string,
    message: string,
    sendAt: Date,
  ): Promise<string> {
    return this.schedulerService.scheduleJob(
      'send-reminder',
      { userId, message },
      sendAt,
    );
  }

  async setupDailyReports(): void {
    this.schedulerService.scheduleRecurringJob(
      'daily-sales-report',
      '0 9 * * *', // Every day at 9 AM
      async () => {
        await this.generateSalesReport();
      },
    );
  }
}
```

### 24. Using QueueMonitoringService

```typescript
import { Injectable } from '@nestjs/common';
import { QueueMonitoringService } from './queues/monitoring/queue-monitoring.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly monitoringService: QueueMonitoringService,
  ) {}

  async getQueueDashboard() {
    const [metrics, health, statistics] = await Promise.all([
      this.monitoringService.getQueueMetrics(),
      this.monitoringService.checkQueueHealth(),
      this.monitoringService.getQueueStatistics(),
    ]);

    return {
      metrics,
      health,
      statistics,
    };
  }

  async investigateFailures() {
    const failedJobs = await this.monitoringService.getFailedJobs(50);
    
    // Group by error type
    const errorGroups = failedJobs.reduce((acc, job) => {
      const error = job.failedReason || 'Unknown';
      acc[error] = (acc[error] || 0) + 1;
      return acc;
    }, {});

    return errorGroups;
  }
}
```

### 25. Using RetryLogicService

```typescript
import { Injectable } from '@nestjs/common';
import { RetryLogicService } from './queues/retry/retry-logic.service';

@Injectable()
export class CustomProcessor {
  constructor(
    private readonly retryLogicService: RetryLogicService,
  ) {}

  async processWithCustomRetry(data: any): Promise<void> {
    const strategy = {
      maxAttempts: 5,
      backoffType: 'exponential' as const,
      initialDelay: 1000,
      maxDelay: 30000,
      multiplier: 2,
    };

    let attempt = 0;
    while (attempt < strategy.maxAttempts) {
      try {
        await this.doWork(data);
        return;
      } catch (error) {
        attempt++;
        
        if (!this.retryLogicService.shouldRetry(error, attempt, strategy.maxAttempts)) {
          throw error;
        }

        const delay = this.retryLogicService.calculateBackoffDelay(
          attempt,
          strategy,
        );

        await this.sleep(delay);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Real-World Scenarios

### 26. Email Campaign

```typescript
async sendEmailCampaign(campaignId: string): Promise<void> {
  const recipients = await this.getRecipients(campaignId);
  
  const jobs = recipients.map(recipient => ({
    name: 'send-email',
    data: {
      to: recipient.email,
      campaignId,
      userId: recipient.id,
    },
    options: {
      priority: JobPriority.NORMAL,
      attempts: 3,
    },
  }));

  await this.queueService.addBulkJobs(jobs);
}
```

### 27. Report Generation with Scheduling

```typescript
async scheduleMonthlyReports(): Promise<void> {
  const users = await this.getPremiumUsers();
  
  for (const user of users) {
    // Schedule for first day of next month at 9 AM
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    nextMonth.setHours(9, 0, 0, 0);

    await this.schedulerService.scheduleJob(
      'generate-report',
      {
        userId: user.id,
        reportType: 'monthly',
      },
      nextMonth,
    );
  }
}
```

### 28. Payment Processing with Priority

```typescript
async processUrgentPayment(paymentData: any): Promise<void> {
  const priority = this.prioritizationService.calculatePriority({
    userTier: paymentData.userTier,
    urgency: 'critical',
    businessImpact: 'revenue',
    deadline: new Date(Date.now() + 3600000), // 1 hour
  });

  await this.queueService.addJob(
    'process-payment',
    paymentData,
    {
      priority,
      attempts: 5,
      timeout: 60000,
    },
  );
}
```

### 29. Monitoring Dashboard

```typescript
@Get('admin/queue-dashboard')
async getQueueDashboard() {
  const [metrics, health, failedJobs, stuckJobs] = await Promise.all([
    this.monitoringService.getQueueMetrics(),
    this.monitoringService.checkQueueHealth(),
    this.monitoringService.getFailedJobs(10),
    this.monitoringService.getStuckJobs(),
  ]);

  return {
    metrics,
    health,
    recentFailures: failedJobs.length,
    stuckJobsCount: stuckJobs.length,
    alerts: health.issues,
  };
}
```

### 30. Cleanup and Maintenance

```typescript
@Cron('0 2 * * *') // Every day at 2 AM
async performMaintenance(): Promise<void> {
  // Clean completed jobs older than 24 hours
  await this.queueService.cleanQueue(24 * 60 * 60 * 1000, 'completed');
  
  // Clean failed jobs older than 7 days
  await this.queueService.cleanQueue(7 * 24 * 60 * 60 * 1000, 'failed');
  
  // Check for stuck jobs
  const stuckJobs = await this.monitoringService.getStuckJobs();
  if (stuckJobs.length > 0) {
    this.logger.warn(`Found ${stuckJobs.length} stuck jobs during maintenance`);
  }
  
  // Log metrics
  const metrics = await this.monitoringService.getQueueMetrics();
  this.logger.log('Maintenance complete', metrics);
}
```
