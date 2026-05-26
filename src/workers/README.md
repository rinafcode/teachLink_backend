# Async Task Workers Module

Comprehensive async task processing system with dedicated worker processes, job orchestration, health monitoring, and dynamic scaling.

## Overview

The Workers Module provides a scalable, distributed task processing system built on top of the Queue Module. It implements specialized worker processes for different job types, automatic health monitoring, and intelligent job routing.

## Architecture

```
src/workers/
├── base/
│   └── base.worker.ts                    # Abstract base worker class
├── processors/
│   ├── email.worker.ts                   # Email processing worker
│   ├── media-processing.worker.ts        # Media/image/video processing
│   ├── data-sync.worker.ts               # Data synchronization worker
│   ├── backup-processing.worker.ts       # Backup/restore operations
│   ├── webhooks.worker.ts                # Webhook delivery worker
│   ├── subscriptions.worker.ts           # Subscription management worker
│   └── index.ts                          # Export all workers
├── orchestration/
│   └── worker-orchestration.service.ts   # Worker pool management
├── health/
│   └── worker-health-check.service.ts    # Health monitoring
├── interfaces/
│   └── worker.interfaces.ts              # TypeScript interfaces
└── workers.module.ts                     # Workers module
```

## Key Features

### 1. **Specialized Workers**

Each worker type handles specific job categories:

- **EmailWorker**: Email sending and notifications
- **MediaProcessingWorker**: Image optimization, video transcoding, audio processing
- **DataSyncWorker**: Data replication, consistency checks, reconciliation
- **BackupProcessingWorker**: Full/incremental/differential backups, restore operations
- **WebhooksWorker**: Webhook delivery with retry logic
- **SubscriptionsWorker**: Subscription billing, renewals, upgrades/downgrades

### 2. **Worker Orchestration**

The `WorkerOrchestrationService` manages:

- Worker pool initialization and lifecycle
- Intelligent job routing to appropriate workers
- Worker scaling (dynamic worker count adjustment)
- Worker registry and discovery
- Pool statistics and monitoring

### 3. **Health Monitoring**

The `WorkerHealthCheckService` provides:

- Real-time health status for each worker
- Anomaly detection (execution time spikes, high failure rates)
- Pool-wide health percentage
- Automated alerts and notifications
- Metric aggregation and reporting

### 4. **Base Worker Class**

All workers extend `BaseWorker` which provides:

- Common job execution lifecycle
- Automatic metrics collection
- Progress tracking
- Health check support
- Uptime tracking

## Usage

### Initialize Workers Module

```typescript
import { WorkersModule } from './workers/workers.module';

@Module({
  imports: [
    WorkersModule,
    QueueModule,
    // ... other modules
  ],
})
export class AppModule {}
```

### Inject and Use

```typescript
import { WorkerOrchestrationService } from './workers/orchestration/worker-orchestration.service';
import { WorkerHealthCheckService } from './workers/health/worker-health-check.service';

@Injectable()
export class TaskService {
  constructor(
    private readonly workerOrchestration: WorkerOrchestrationService,
    private readonly healthCheck: WorkerHealthCheckService,
  ) {}

  async processJob(job: Job): Promise<any> {
    return this.workerOrchestration.routeJob(job);
  }

  async getWorkerHealth(): Promise<any> {
    return this.healthCheck.performComprehensiveHealthCheck();
  }
}
```

## Worker Configuration

Default configurations for each worker type:

| Worker | Concurrency | Workers | Retries | Timeout | Health Check |
|--------|-------------|---------|---------|---------|--------------|
| Email | 5 | 2 | 3 | 30s | 30s |
| Media Processing | 3 | 1 | 2 | 2min | 1min |
| Data Sync | 4 | 2 | 3 | 1min | 45s |
| Backup Processing | 1 | 1 | 2 | 5min | 2min |
| Webhooks | 10 | 3 | 5 | 15s | 30s |
| Subscriptions | 5 | 2 | 3 | 45s | 30s |

## Job Routing

Jobs are automatically routed to appropriate workers based on job name:

```typescript
// Automatically routes to EmailWorker
await queueService.addJob('send-email', {
  to: 'user@example.com',
  subject: 'Welcome!',
  template: 'welcome',
});

// Automatically routes to MediaProcessingWorker
await queueService.addJob('process-image', {
  mediaType: 'image',
  fileUrl: 's3://bucket/image.jpg',
  format: 'webp',
});

// Automatically routes to WebhooksWorker
await queueService.addJob('call-webhook', {
  url: 'https://example.com/webhook',
  event: 'user.created',
  payload: { userId: 123 },
});
```

## Health Monitoring

### Get Pool Health

```typescript
@Get('/health/workers')
async getWorkersHealth() {
  return this.healthCheck.performComprehensiveHealthCheck();
}

// Response:
{
  timestamp: '2024-04-28T10:30:00.000Z',
  totalWorkers: 14,
  healthyWorkers: 12,
  degradedWorkers: 2,
  unhealthyWorkers: 0,
  poolStats: {
    totalWorkers: 14,
    totalJobsProcessed: 5000,
    totalJobsFailed: 50,
    totalJobsSucceeded: 4950,
    averageExecutionTime: 245.5,
    successRate: 99
  },
  alerts: []
}
```

### Get Individual Worker Health

```typescript
@Get('/health/workers/:workerId')
async getWorkerHealth(@Param('workerId') workerId: string) {
  return this.healthCheck.getWorkerHealth(workerId);
}

// Response:
{
  workerId: 'email-1714300200123-abc123def456',
  status: 'healthy',
  message: 'Worker is healthy',
  metrics: {
    workerId: 'email-1714300200123-abc123def456',
    workerType: 'email',
    jobsProcessed: 450,
    jobsFailed: 5,
    jobsSucceeded: 445,
    averageExecutionTime: 125.3,
    lastExecutionTime: 118,
    uptime: 3600000,
    memoryUsage: 45.2,
    cpuUsage: 120.5,
    status: 'healthy',
    lastUpdate: '2024-04-28T10:30:00.000Z'
  },
  lastCheck: '2024-04-28T10:30:00.000Z'
}
```

### Detect Anomalies

```typescript
@Get('/health/workers/anomalies')
async detectAnomalies() {
  return this.healthCheck.detectAnomalies();
}

// Response:
[
  {
    workerId: 'media-processing-1714300200456-xyz789',
    type: 'slow-execution',
    message: 'Execution time (2500ms) exceeds average by 3x'
  },
  {
    workerId: 'webhooks-1714300200789-uvw123',
    type: 'high-failure-rate',
    message: 'Failure rate (25.50%) exceeds average by 2x'
  }
]
```

## Scaling Workers

### Manual Scaling

```typescript
@Post('/workers/:type/scale')
async scaleWorkers(
  @Param('type') workerType: string,
  @Body() { workerCount }: { workerCount: number },
) {
  await this.workerOrchestration.scaleWorkerPool(workerType, workerCount);
  return { message: `Scaled ${workerType} to ${workerCount} workers` };
}
```

### Auto-Scaling (Recommended)

Implement auto-scaling based on queue depth:

```typescript
// In a scheduled service
@Cron('0 * * * * *') // Every minute
async autoScaleWorkers() {
  const metrics = this.workerOrchestration.getAllWorkerMetrics();
  
  for (const metric of metrics) {
    const failureRate = metric.jobsProcessed > 0 
      ? metric.jobsFailed / metric.jobsProcessed 
      : 0;
    
    if (failureRate > 0.2) {
      // Scale up degraded workers
      await this.workerOrchestration.scaleWorkerPool(
        metric.workerType, 
        metric.jobsProcessed / metric.avgExecutionTime + 1
      );
    }
  }
}
```

## Worker Metrics

### Metrics Available

- `jobsProcessed`: Total jobs processed by worker
- `jobsFailed`: Number of failed jobs
- `jobsSucceeded`: Number of successful jobs
- `averageExecutionTime`: Average execution time in milliseconds
- `lastExecutionTime`: Most recent job execution time
- `uptime`: Worker uptime in milliseconds
- `memoryUsage`: Current memory usage in MB
- `cpuUsage`: CPU usage in milliseconds
- `status`: Worker health status (healthy/degraded/unhealthy/idle)

### Access Metrics

```typescript
@Get('/metrics/workers')
async getWorkerMetrics() {
  return this.workerOrchestration.getAllWorkerMetrics();
}

@Get('/metrics/pool-stats')
async getPoolStats() {
  return this.workerOrchestration.getPoolStatistics();
}
```

## Best Practices

1. **Job Naming**: Use consistent, descriptive job names to enable proper routing
2. **Progress Updates**: Call `job.progress()` during execution for tracking
3. **Error Handling**: Workers automatically handle retries per configuration
4. **Monitoring**: Enable health checks to detect issues early
5. **Scaling**: Monitor metrics and scale based on failure rates and execution times
6. **Timeouts**: Set appropriate timeouts for each job type
7. **Resource Management**: Monitor memory usage and scale workers accordingly

## Performance Considerations

- Email jobs are high concurrency (5) but CPU light
- Media processing is lower concurrency (3) due to CPU/I/O intensity
- Backup jobs have concurrency of 1 to prevent resource contention
- Webhook delivery has highest concurrency (10) with short timeouts
- Adjust concurrency based on your infrastructure capacity

## Testing

Workers can be tested in isolation:

```typescript
describe('EmailWorker', () => {
  let worker: EmailWorker;

  beforeEach(() => {
    worker = new EmailWorker();
  });

  it('should process email job', async () => {
    const job = {
      name: 'send-email',
      data: { to: 'test@example.com', subject: 'Test' },
      progress: jest.fn(),
    } as any;

    const result = await worker.handle(job);
    expect(result.success).toBe(true);
    expect(result.data.to).toBe('test@example.com');
  });
});
```

## Troubleshooting

### Workers Stuck/Unhealthy

1. Check health status: `GET /health/workers`
2. Review anomalies: `GET /health/workers/anomalies`
3. Check individual worker metrics
4. Scale up workers if needed
5. Check job logs for specific failures

### High Failure Rate

1. Check job payloads for invalid data
2. Review timeout settings
3. Check external service availability
4. Increase retry attempts for transient failures

### Memory Leaks

1. Monitor `memoryUsage` metric
2. Check for unreleased resources in worker execute methods
3. Consider restarting workers if memory grows unbounded
4. Scale down workers to release memory

## Migration from Synchronous Processing

1. Identify long-running operations
2. Convert to job-based processing using `queueService.addJob()`
3. Deploy Workers Module
4. Update API endpoints to return job ID immediately
5. Add polling/webhook for job completion notifications
6. Monitor metrics and adjust worker configurations

## Related Documentation

- [Queue Module Documentation](../queues/README.md)
- [Job Prioritization](../queues/prioritization/README.md)
- [Retry Logic](../queues/retry/README.md)
- [Job Scheduling](../queues/scheduler/README.md)
