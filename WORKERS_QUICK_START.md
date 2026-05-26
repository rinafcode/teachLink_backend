# Async Workers Quick Start Guide

## TL;DR - Getting Started in 5 Minutes

### 1. Add a Job to the Queue

```typescript
import { QueueService } from './queues/queue.service';

@Injectable()
export class MyService {
  constructor(private readonly queueService: QueueService) {}

  async doSomethingAsync() {
    // Send email asynchronously
    await this.queueService.addJob('send-email', {
      to: 'user@example.com',
      subject: 'Welcome!',
      template: 'welcome',
      variables: { name: 'John' }
    });

    // Return immediately - processing happens in background
    return { status: 'processing', message: 'Email queued for sending' };
  }
}
```

### 2. Monitor Worker Health

```typescript
import { WorkerHealthCheckService } from './workers/health/worker-health-check.service';

@Get('/health/workers')
async getWorkersHealth() {
  const health = await this.healthCheckService.performComprehensiveHealthCheck();
  return {
    totalWorkers: health.totalWorkers,
    healthyWorkers: health.healthyWorkers,
    successRate: `${health.poolStats.successRate.toFixed(2)}%`,
    alerts: health.alerts
  };
}
```

## Supported Job Types

| Job Name | Worker | Purpose |
|----------|--------|---------|
| `send-email` | EmailWorker | Send emails |
| `process-image` | MediaProcessingWorker | Optimize images |
| `process-video` | MediaProcessingWorker | Transcode videos |
| `process-audio` | MediaProcessingWorker | Process audio |
| `consistency-check` | DataSyncWorker | Check data consistency |
| `replicate-data` | DataSyncWorker | Replicate data |
| `reconcile` | DataSyncWorker | Reconcile data |
| `backup-data` | BackupProcessingWorker | Full database backup |
| `call-webhook` | WebhooksWorker | Deliver webhook |
| `subscription-create` | SubscriptionsWorker | Create subscription |
| `subscription-renew` | SubscriptionsWorker | Renew subscription |

## Common Patterns

### Pattern 1: Fire and Forget
```typescript
// Add job and don't wait for result
await this.queueService.addJob('send-email', emailData);
```

### Pattern 2: Track Job Status
```typescript
// Add job and track progress
const job = await this.queueService.addJob('process-image', imageData);
const jobId = job.id;

// Later, check status
const status = await this.queueService.getJob(jobId);
const progress = await status.progress();
```

### Pattern 3: Priority Jobs
```typescript
// High priority job
await this.queueService.addJob(
  'send-email', 
  emailData,
  { priority: JobPriority.HIGH }
);

// Low priority job
await this.queueService.addJob(
  'backup-data',
  backupData,
  { priority: JobPriority.LOW }
);
```

### Pattern 4: Scheduled Jobs
```typescript
// Schedule for specific time
const scheduledTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
await this.jobSchedulerService.scheduleJob(
  'send-email',
  emailData,
  scheduledTime
);
```

### Pattern 5: Bulk Operations
```typescript
// Add multiple jobs at once
await this.queueService.addBulkJobs([
  { name: 'send-email', data: emailData1 },
  { name: 'send-email', data: emailData2 },
  { name: 'send-email', data: emailData3 }
]);
```

## Health Check Examples

### Check if Pool is Healthy
```typescript
const isHealthy = await this.healthCheckService.isPoolHealthy();
if (!isHealthy) {
  // Scale up workers or alert
}
```

### Get Pool Health Percentage
```typescript
const healthPercentage = await this.healthCheckService.getPoolHealthPercentage();
console.log(`Pool health: ${healthPercentage}%`);
```

### Detect Anomalies
```typescript
const anomalies = await this.healthCheckService.detectAnomalies();
anomalies.forEach(anomaly => {
  console.log(`${anomaly.workerId}: ${anomaly.message}`);
});
```

## Auto-Scaling Example

```typescript
@Cron('0 * * * * *') // Every minute
async autoScaleWorkers() {
  const health = await this.healthCheckService.performComprehensiveHealthCheck();
  
  for (const workerType of ['email', 'media-processing', 'webhooks']) {
    const workers = this.workerOrchestration.getWorkersByType(workerType);
    const stats = this.workerOrchestration.getPoolStatistics();
    
    // Scale up if many jobs in queue
    if (stats.totalJobsProcessed > 1000) {
      await this.workerOrchestration.scaleWorkerPool(workerType, workers.length + 1);
    }
    
    // Scale down if low activity
    if (stats.totalJobsProcessed < 100 && workers.length > 1) {
      await this.workerOrchestration.scaleWorkerPool(workerType, workers.length - 1);
    }
  }
}
```

## Troubleshooting

### Issue: Jobs Not Processing
**Solution**: Check worker health
```typescript
const health = await this.healthCheckService.performComprehensiveHealthCheck();
console.log(health); // Check for alerts
```

### Issue: High Memory Usage
**Solution**: Check individual worker metrics
```typescript
const metrics = this.workerOrchestration.getAllWorkerMetrics();
const highMemory = metrics.filter(m => m.memoryUsage > 500);
console.log(`Workers with high memory:`, highMemory);
```

### Issue: High Failure Rate
**Solution**: Check anomalies
```typescript
const anomalies = await this.healthCheckService.detectAnomalies();
const failures = anomalies.filter(a => a.type === 'high-failure-rate');
console.log(`Workers with high failure rate:`, failures);
```

### Issue: Slow Job Processing
**Solution**: Check execution times
```typescript
const metrics = this.workerOrchestration.getAllWorkerMetrics();
const slow = metrics.filter(m => m.averageExecutionTime > 5000);
console.log(`Slow workers:`, slow);
```

## API Reference

### QueueService
- `addJob(name, data, options?)` - Add single job
- `addBulkJobs(jobs)` - Add multiple jobs
- `getJob(jobId)` - Get job status

### WorkerOrchestrationService
- `routeJob(job)` - Route job to worker
- `getActiveWorkers()` - Get all active workers
- `getWorkersByType(type)` - Get workers by type
- `getAllWorkerMetrics()` - Get all metrics
- `getPoolStatistics()` - Get pool stats
- `scaleWorkerPool(type, count)` - Scale workers

### WorkerHealthCheckService
- `performComprehensiveHealthCheck()` - Full health check
- `getWorkerHealth(workerId)` - Worker health
- `getAllWorkersHealth()` - All health statuses
- `isPoolHealthy()` - Boolean health status
- `getPoolHealthPercentage()` - Health as percentage
- `detectAnomalies()` - Find anomalies

## Best Practices

1. ✅ Use descriptive job names
2. ✅ Monitor worker health regularly
3. ✅ Set appropriate timeouts for job types
4. ✅ Use bulk operations for many similar jobs
5. ✅ Scale workers based on metrics
6. ✅ Implement auto-scaling for production
7. ✅ Use priority for critical jobs
8. ✅ Clean up old completed jobs periodically

## Performance Tips

1. **Email**: Use bulk operations for newsletters
2. **Media**: Process videos during off-peak hours
3. **Backups**: Schedule during low-traffic periods
4. **Webhooks**: Use highest concurrency for delivery
5. **Subscriptions**: Batch billing operations

## For More Information

- [Full Workers Module Documentation](./src/workers/README.md)
- [Queue Module Documentation](./src/queues/README.md)
- [Complete Implementation Summary](./ASYNC_WORKERS_IMPLEMENTATION.md)
- [Test Examples](./src/workers/processors/*.spec.ts)
