# Advanced Queue Management System

Comprehensive queue management with job prioritization, intelligent retry logic, real-time monitoring, and job scheduling.

## Features

- **Priority-Based Processing**: Jobs processed based on configurable priority levels
- **Intelligent Retry Logic**: Exponential backoff with jitter for failed jobs
- **Real-Time Monitoring**: Queue health checks and performance metrics
- **Job Scheduling**: Schedule jobs for specific times or recurring execution
- **Automatic Recovery**: Detects and recovers stuck jobs
- **Performance Optimization**: Scales with load using Bull and Redis

## Architecture

```
src/queues/
├── queue.module.ts                    # Main module
├── queue.service.ts                   # Core queue operations
├── queue.controller.ts                # REST API endpoints
├── enums/
│   └── job-priority.enum.ts          # Priority and status enums
├── interfaces/
│   └── queue.interfaces.ts           # TypeScript interfaces
├── prioritization/
│   └── prioritization.service.ts     # Job priority calculation
├── retry/
│   └── retry-logic.service.ts        # Retry strategies
├── monitoring/
│   └── queue-monitoring.service.ts   # Health checks and metrics
├── scheduler/
│   └── job-scheduler.service.ts      # Job scheduling
└── processors/
    └── default-queue.processor.ts    # Job processing logic
```

## Job Priorities

Jobs are processed in order of priority:

1. **CRITICAL** (1) - Highest priority, 5 retry attempts
2. **HIGH** (2) - High priority, 4 retry attempts
3. **NORMAL** (3) - Default priority, 3 retry attempts
4. **LOW** (4) - Low priority, 2 retry attempts
5. **BACKGROUND** (5) - Lowest priority, 1 retry attempt

## API Endpoints

### Add Job
```http
POST /queues/jobs
Content-Type: application/json

{
  "name": "send-email",
  "data": {
    "to": "user@example.com",
    "subject": "Welcome",
    "body": "Hello!"
  },
  "options": {
    "priority": 2,
    "attempts": 3
  }
}
```

### Add Job with Priority Calculation
```http
POST /queues/jobs
Content-Type: application/json

{
  "name": "process-payment",
  "data": {
    "amount": 99.99,
    "userId": "123"
  },
  "priorityFactors": {
    "userTier": "premium",
    "urgency": "high",
    "businessImpact": "revenue",
    "deadline": "2024-12-31T23:59:59Z"
  }
}
```

### Schedule Job
```http
POST /queues/jobs/schedule
Content-Type: application/json

{
  "name": "send-reminder",
  "data": {
    "userId": "123",
    "message": "Don't forget!"
  },
  "scheduledTime": "2024-12-25T09:00:00Z"
}
```

### Get Queue Metrics
```http
GET /queues/metrics
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

### Get Queue Health
```http
GET /queues/health
```

Response:
```json
{
  "status": "healthy",
  "issues": [],
  "metrics": { ... },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Get Failed Jobs
```http
GET /queues/jobs/failed?limit=10
```

### Retry Failed Job
```http
POST /queues/jobs/:id/retry
```

### Pause Queue
```http
POST /queues/pause
```

### Resume Queue
```http
POST /queues/resume
```

## Usage Examples

### Basic Job Addition

```typescript
import { QueueService } from './queues/queue.service';
import { JobPriority } from './queues/enums/job-priority.enum';

// Inject QueueService
constructor(private queueService: QueueService) {}

// Add a job
await this.queueService.addJob('send-email', {
  to: 'user@example.com',
  subject: 'Welcome',
  body: 'Hello!'
}, {
  priority: JobPriority.HIGH,
  attempts: 3
});
```

### Priority Calculation

```typescript
import { PrioritizationService } from './queues/prioritization/prioritization.service';

constructor(private prioritizationService: PrioritizationService) {}

// Calculate priority based on factors
const priority = this.prioritizationService.calculatePriority({
  userTier: 'premium',
  urgency: 'high',
  businessImpact: 'revenue',
  deadline: new Date('2024-12-31')
});

// Get recommended options for this priority
const options = this.prioritizationService.getJobOptions(priority);

// Add job with calculated priority
await this.queueService.addJob('important-task', data, options);
```

### Job Scheduling

```typescript
import { JobSchedulerService } from './queues/scheduler/job-scheduler.service';

constructor(private schedulerService: JobSchedulerService) {}

// Schedule for specific time
await this.schedulerService.scheduleJob(
  'send-reminder',
  { userId: '123' },
  new Date('2024-12-25T09:00:00Z')
);

// Schedule with delay
await this.schedulerService.scheduleDelayedJob(
  'cleanup-temp-files',
  {},
  60000 // 1 minute
);

// Schedule recurring job
this.schedulerService.scheduleRecurringJob(
  'daily-report',
  '0 9 * * *', // Every day at 9 AM
  async () => {
    // Generate report logic
  }
);
```

### Monitoring

```typescript
import { QueueMonitoringService } from './queues/monitoring/queue-monitoring.service';

constructor(private monitoringService: QueueMonitoringService) {}

// Get current metrics
const metrics = await this.monitoringService.getQueueMetrics();

// Check health
const health = await this.monitoringService.checkQueueHealth();

if (health.status === 'critical') {
  // Send alert
}

// Get failed jobs for analysis
const failedJobs = await this.monitoringService.getFailedJobs(50);
```

## Retry Strategies

### Exponential Backoff

```typescript
{
  maxAttempts: 5,
  backoffType: 'exponential',
  initialDelay: 2000,
  maxDelay: 60000,
  multiplier: 2
}
```

Retry delays: 2s, 4s, 8s, 16s, 32s

### Fixed Backoff

```typescript
{
  maxAttempts: 3,
  backoffType: 'fixed',
  initialDelay: 5000
}
```

Retry delays: 5s, 5s, 5s

### Custom Strategy

```typescript
import { RetryLogicService } from './queues/retry/retry-logic.service';

constructor(private retryLogicService: RetryLogicService) {}

const strategy = this.retryLogicService.getDefaultStrategy('email');
const delay = this.retryLogicService.calculateBackoffDelay(2, strategy);
```

## Job Processing

Jobs are processed by the `DefaultQueueProcessor`. Supported job types:

- `send-email` - Email sending
- `generate-report` - Report generation
- `process-payment` - Payment processing
- `backup-data` - Data backup

### Adding Custom Job Types

Edit `src/queues/processors/default-queue.processor.ts`:

```typescript
private async processJobByType(job: Job): Promise<any> {
  switch (job.name) {
    case 'my-custom-job':
      return this.processMyCustomJob(job);
    // ... other cases
  }
}

private async processMyCustomJob(job: Job): Promise<any> {
  // Your processing logic
  await job.progress(50);
  // More logic
  await job.progress(100);
  return { status: 'completed' };
}
```

## Monitoring & Alerts

### Automatic Health Checks

The monitoring service runs health checks every minute:

- Checks failure rate
- Monitors queue backlog
- Detects stuck jobs
- Tracks performance metrics

### Alert Conditions

Alerts are triggered when:
- Failure rate > 10% (warning) or > 20% (critical)
- Waiting jobs > 1000 (warning) or > 5000 (critical)
- Active jobs > 100 (warning)
- Delayed jobs > 500 (warning)
- Jobs stuck for > 5 minutes

### Custom Alerts

Implement `sendAlert()` in `queue-monitoring.service.ts`:

```typescript
private async sendAlert(health: QueueHealthStatus): Promise<void> {
  // Send to Slack
  await this.slackService.send({
    channel: '#alerts',
    text: `Queue health: ${health.status}`,
    attachments: health.issues
  });

  // Send to PagerDuty
  await this.pagerDutyService.trigger({
    severity: health.status,
    summary: health.issues.join(', ')
  });
}
```

## Performance Optimization

### Concurrency

Configure in `queue.module.ts`:

```typescript
BullModule.registerQueue({
  name: 'default',
  processors: [{
    name: '*',
    concurrency: 5 // Process 5 jobs simultaneously
  }]
})
```

### Job Cleanup

Automatic cleanup runs daily at midnight:
- Completed jobs older than 24 hours
- Failed jobs older than 7 days

Manual cleanup:

```http
POST /queues/clean
Content-Type: application/json

{
  "grace": 86400000,
  "status": "completed"
}
```

### Redis Configuration

For production, configure Redis with:
- Persistence enabled
- Sufficient memory
- Connection pooling
- Cluster mode for high availability

## Best Practices

1. **Use Appropriate Priorities**: Reserve CRITICAL for truly critical jobs
2. **Set Realistic Timeouts**: Based on expected job duration
3. **Monitor Regularly**: Check metrics and health status
4. **Handle Failures Gracefully**: Implement proper error handling
5. **Clean Up Old Jobs**: Prevent Redis memory issues
6. **Use Idempotent Jobs**: Jobs should be safe to retry
7. **Log Important Events**: For debugging and auditing
8. **Test Retry Logic**: Ensure jobs recover from failures

## Troubleshooting

### Jobs Not Processing

1. Check Redis connection
2. Verify queue is not paused
3. Check processor is registered
4. Review error logs

### High Failure Rate

1. Check failed jobs: `GET /queues/jobs/failed`
2. Review error messages
3. Verify external service availability
4. Check timeout settings

### Stuck Jobs

1. Check stuck jobs: `GET /queues/jobs/stuck`
2. Review job processing logic
3. Increase timeout if needed
4. Check for deadlocks

### Memory Issues

1. Clean old jobs regularly
2. Enable `removeOnComplete` and `removeOnFail`
3. Monitor Redis memory usage
4. Implement job data size limits

## Testing

```bash
# Add a test job
curl -X POST http://localhost:3000/queues/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "send-email",
    "data": {"to": "test@example.com"},
    "options": {"priority": 2}
  }'

# Check metrics
curl http://localhost:3000/queues/metrics

# Check health
curl http://localhost:3000/queues/health
```

## Production Considerations

1. **Redis High Availability**: Use Redis Sentinel or Cluster
2. **Monitoring Integration**: Connect to APM tools
3. **Alerting**: Set up PagerDuty/Slack notifications
4. **Scaling**: Add more workers as needed
5. **Backup**: Regular Redis backups
6. **Security**: Secure Redis with password and TLS
7. **Rate Limiting**: Prevent queue flooding
8. **Dead Letter Queue**: Handle permanently failed jobs

## Dependencies

- `@nestjs/bull` - Bull queue integration
- `bull` - Queue implementation
- `@nestjs/schedule` - Cron job scheduling
- `redis` - Redis client

## Resources

- [Bull Documentation](https://github.com/OptimalBits/bull)
- [NestJS Bull](https://docs.nestjs.com/techniques/queues)
- [Redis Best Practices](https://redis.io/topics/best-practices)
