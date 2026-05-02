/**
 * Self-contained tests for QueueMonitoringService logic.
 * All Bull queue methods are mocked inline.
 */
// ─── Inline type definitions (no NestJS imports needed)
interface ITimestampedMetrics {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  total: number;
  throughput: number;
  avgProcessingTime: number;
  capturedAt: number;
}

interface IQueueHealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  issues: string[];
  metrics: any;
  timestamp: Date;
}

interface IBulkRetryResult {
  requeued: number;
  skipped: number;
  errors: Array<{ jobId: string | number; reason: string }>;
}
// ─── Minimal monitoring service (extracted logic, no decorators)
class QueueMonitoringService {
  private readonly metricsHistory: ITimestampedMetrics[] = [];
  private readonly MAX_HISTORY_SIZE = 100;
  private readonly THRESHOLDS = {
    failureRateCritical: 0.2,
    failureRateWarning: 0.1,
    backlogCritical: 5_000,
    backlogWarning: 1_000,
    activeJobsCritical: 500,
    activeJobsWarning: 100,
    delayedJobsWarning: 500,
    stuckThresholdMs: 300_000,
  };

  constructor(private readonly queue: any) {}

  async getQueueMetrics(): Promise<ITimestampedMetrics> {
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
      this.queue.getPausedCount(),
    ]);

    const total = waiting + active + completed + failed + delayed + paused;
    const capturedAt = Date.now();
    const throughput = this.calculateThroughput(completed, capturedAt);
    const avgProcessingTime = await this.calculateAvgProcessingTime();

    const metrics: ITimestampedMetrics = {
      queueName: 'default',
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused,
      total,
      throughput,
      avgProcessingTime,
      capturedAt,
    };

    this.appendToHistory(metrics);
    return metrics;
  }

  getMetricsHistory(): ITimestampedMetrics[] {
    return [...this.metricsHistory];
  }

  async checkQueueHealth(): Promise<IQueueHealthStatus> {
    const metrics = await this.getQueueMetrics();
    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    const failureRate = metrics.total > 0 ? metrics.failed / metrics.total : 0;
    if (failureRate > this.THRESHOLDS.failureRateCritical) {
      issues.push(`Critical failure rate: ${(failureRate * 100).toFixed(1)}%`);
      status = 'critical';
    } else if (failureRate > this.THRESHOLDS.failureRateWarning) {
      issues.push(`Elevated failure rate: ${(failureRate * 100).toFixed(1)}%`);
      if (status === 'healthy') status = 'warning';
    }
    getMetricsHistory(): TimestampedMetrics[] {
        return [...this.metricsHistory];
    }
    async checkQueueHealth(): Promise<QueueHealthStatus> {
        const metrics = await this.getQueueMetrics();
        const issues: string[] = [];
        let status: 'healthy' | 'warning' | 'critical' = 'healthy';
        const failureRate = metrics.total > 0 ? metrics.failed / metrics.total : 0;
        if (failureRate > this.THRESHOLDS.failureRateCritical) {
            issues.push(`Critical failure rate: ${(failureRate * 100).toFixed(1)}%`);
            status = 'critical';
        }
        else if (failureRate > this.THRESHOLDS.failureRateWarning) {
            issues.push(`Elevated failure rate: ${(failureRate * 100).toFixed(1)}%`);
            if (status === 'healthy')
                status = 'warning';
        }
        if (metrics.waiting > this.THRESHOLDS.backlogCritical) {
            issues.push(`Critical backlog: ${metrics.waiting} waiting jobs`);
            status = 'critical';
        }
        else if (metrics.waiting > this.THRESHOLDS.backlogWarning) {
            issues.push(`Elevated backlog: ${metrics.waiting} waiting jobs`);
            if (status === 'healthy')
                status = 'warning';
        }
        if (metrics.active > this.THRESHOLDS.activeJobsCritical) {
            issues.push(`Critical active-job count: ${metrics.active}`);
            status = 'critical';
        }
        else if (metrics.active > this.THRESHOLDS.activeJobsWarning) {
            issues.push(`High active-job count: ${metrics.active}`);
            if (status === 'healthy')
                status = 'warning';
        }
        if (metrics.delayed > this.THRESHOLDS.delayedJobsWarning) {
            issues.push(`Many delayed jobs: ${metrics.delayed}`);
            if (status === 'healthy')
                status = 'warning';
        }
        if (metrics.throughput === 0 && metrics.waiting > 0 && metrics.active === 0) {
            issues.push('Queue appears stalled: jobs waiting but none active and throughput is zero');
            if (status === 'healthy')
                status = 'warning';
        }
        return { status, issues, metrics, timestamp: new Date() };
    }
    async getQueueStatistics() {
        const metrics = await this.getQueueMetrics();
        const history = this.metricsHistory;
        return {
            current: metrics,
            trends: {
                completed: this.calculateTrend(history.map((m) => m.completed)),
                failed: this.calculateTrend(history.map((m) => m.failed)),
                throughput: this.calculateTrend(history.map((m) => m.throughput)),
            },
            health: await this.checkQueueHealth(),
        };
    }
    async getFailedJobs(limit = 50, offset = 0, jobName?: string) {
        if (jobName) {
            const all = await this.queue.getFailed(0, 5000);
            const filtered = all.filter((j: unknown) => j.name === jobName);
            return filtered.slice(offset, offset + limit);
        }
        return this.queue.getFailed(offset, offset + limit - 1);
    }
    async retryAllFailedJobs(): Promise<BulkRetryResult> {
        const failed = await this.queue.getFailed(0, 10000);
        const result: BulkRetryResult = { requeued: 0, skipped: 0, errors: [] };
        for (const job of failed) {
            try {
                await job.retry();
                result.requeued++;
            }
            catch (err) {
                result.errors.push({ jobId: job.id, reason: (err as Error).message });
                result.skipped++;
            }
        }
        return result;
    }
    return this.queue.getFailed(offset, offset + limit - 1);
  }

  async retryAllFailedJobs(): Promise<IBulkRetryResult> {
    const failed = await this.queue.getFailed(0, 10_000);
    const result: IBulkRetryResult = { requeued: 0, skipped: 0, errors: [] };
    for (const job of failed) {
      try {
        await job.retry();
        result.requeued++;
      } catch (err) {
        result.errors.push({ jobId: job.id, reason: (err as Error).message });
        result.skipped++;
      }
    }
    async getRetryAnalytics(windowMinutes = 60) {
        const windowMs = windowMinutes * 60 * 1000;
        const cutoff = Date.now() - windowMs;
        const [failedJobs, completedJobs] = await Promise.all([
            this.queue.getFailed(0, 2000),
            this.queue.getCompleted(0, 2000),
        ]);
        const recentFailed = failedJobs.filter((j: unknown) => (j.finishedOn ?? j.timestamp) >= cutoff);
        const recentCompleted = completedJobs.filter((j: unknown) => (j.finishedOn ?? j.timestamp) >= cutoff);
        const successAfterRetry = recentCompleted.filter((j: unknown) => j.attemptsMade > 1);
        const permanentlyFailed = recentFailed.filter((j: unknown) => j.attemptsMade >= (j.opts?.attempts ?? 3));
        const retried = recentFailed.filter((j: unknown) => j.attemptsMade > 1);
        const byJobType: Record<string, {
            failed: number;
            retried: number;
            avgAttempts: number;
        }> = {};
        for (const job of [...recentFailed, ...recentCompleted]) {
            const bucket = byJobType[job.name] ?? { failed: 0, retried: 0, avgAttempts: 0 };
            const isFailed = recentFailed.includes(job);
            if (isFailed)
                bucket.failed++;
            if (isFailed && job.attemptsMade > 1)
                bucket.retried++;
            bucket.avgAttempts =
                (bucket.avgAttempts * (bucket.failed + bucket.retried - 1) + job.attemptsMade) /
                    Math.max(bucket.failed + bucket.retried, 1);
            byJobType[job.name] = bucket;
        }
        const totalFailed = recentFailed.length;
        return {
            windowMinutes,
            totalFailed,
            totalRetried: retried.length,
            successAfterRetry: successAfterRetry.length,
            permanentlyFailed: permanentlyFailed.length,
            retryRate: totalFailed > 0 ? retried.length / totalFailed : 0,
            successAfterRetryRate: retried.length > 0 ? successAfterRetry.length / retried.length : 0,
            byJobType,
        };
    }
    private calculateThroughput(currentCompleted: number, capturedAt: number): number {
        if (this.metricsHistory.length === 0)
            return 0;
        const previous = this.metricsHistory[this.metricsHistory.length - 1];
        const deltaCompleted = Math.max(0, currentCompleted - previous.completed);
        const deltaMs = capturedAt - previous.capturedAt;
        if (deltaMs <= 0)
            return 0;
        return Math.round((deltaCompleted / deltaMs) * 60000);
    }
    private async calculateAvgProcessingTime(): Promise<number> {
        try {
            const completed = await this.queue.getCompleted(0, 100);
            if (!completed.length)
                return 0;
            const times = completed
                .filter((j: unknown) => j.finishedOn != null && j.processedOn != null)
                .map((j: unknown) => j.finishedOn - j.processedOn);
            if (!times.length)
                return 0;
            return Math.round(times.reduce((a: number, b: number) => a + b, 0) / times.length);
        }
        catch {
            return 0;
        }
    }
    private appendToHistory(metrics: TimestampedMetrics): void {
        this.metricsHistory.push(metrics);
        if (this.metricsHistory.length > this.MAX_HISTORY_SIZE)
            this.metricsHistory.shift();
    }
    private calculateTrend(values: number[]): 'up' | 'down' | 'stable' {
        if (values.length < 2)
            return 'stable';
        const recent = values.slice(-10);
        const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const latest = recent[recent.length - 1];
        if (avg === 0)
            return 'stable';
        const changePct = ((latest - avg) / avg) * 100;
        if (changePct > 10)
            return 'up';
        if (changePct < -10)
            return 'down';
        return 'stable';
    }
  }

  private appendToHistory(metrics: ITimestampedMetrics): void {
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > this.MAX_HISTORY_SIZE) this.metricsHistory.shift();
  }

  private calculateTrend(values: number[]): 'up' | 'down' | 'stable' {
    if (values.length < 2) return 'stable';
    const recent = values.slice(-10);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const latest = recent[recent.length - 1];
    if (avg === 0) return 'stable';
    const changePct = ((latest - avg) / avg) * 100;
    if (changePct > 10) return 'up';
    if (changePct < -10) return 'down';
    return 'stable';
  }
}
// ─── Controller logic (extracted, no NestJS decorators)
class QueueController {
    constructor(private readonly queueService: unknown, private readonly prioritizationService: unknown, private readonly schedulerService: unknown, private readonly monitoringService: QueueMonitoringService) { }
    async getMetrics() {
        return this.monitoringService.getQueueMetrics();
    }
    async getStatistics() {
        return this.monitoringService.getQueueStatistics();
    }
    async getHealth() {
        return this.monitoringService.checkQueueHealth();
    }
    async getCounts() {
        return this.queueService.getQueueCounts();
    }
    async getMetricsHistory() {
        return { history: this.monitoringService.getMetricsHistory() };
    }
    async getRetryAnalytics(query: unknown) {
        return this.monitoringService.getRetryAnalytics(query.windowMinutes ?? 60);
    }
    async getFailedJobs(query: unknown) {
        const limit = query.limit ?? 50;
        const offset = query.offset ?? 0;
        const jobs = await this.monitoringService.getFailedJobs(limit, offset, query.jobName);
        return {
            data: jobs.map((job: unknown) => ({
                id: job.id,
                name: job.name,
                data: job.data,
                failedReason: job.failedReason,
                attemptsMade: job.attemptsMade,
                maxAttempts: job.opts?.attempts ?? 3,
                stackTrace: job.stacktrace ?? [],
                timestamp: new Date(job.timestamp).toISOString(),
                processedOn: job.processedOn ? new Date(job.processedOn).toISOString() : null,
                finishedOn: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
            })),
            meta: { limit, offset, total: jobs.length },
        };
    }
    async retryAllFailedJobs() {
        return this.monitoringService.retryAllFailedJobs();
    }
    async getStuckJobs(query: unknown) {
        const threshold = query.threshold ?? 300000;
        const jobs = await this.monitoringService.getStuckJobs(threshold);
        return {
            data: jobs.map((job: unknown) => ({
                id: job.id,
                name: job.name,
                data: job.data,
                processedOn: job.processedOn ? new Date(job.processedOn).toISOString() : null,
                activeForMs: job.processedOn ? Date.now() - job.processedOn : null,
                attemptsMade: job.attemptsMade,
                priority: job.opts?.priority,
            })),
            thresholdMs: threshold,
        };
    }
    async getJob(id: string) {
        const metrics = await this.queueService.getJobMetrics(id);
        if (!metrics)
            throw new Error(`Job ${id} not found`);
        return metrics;
    }
    async retryJob(id: string) {
        const job = await this.queueService.getJob(id);
        if (!job)
            throw new Error(`Job ${id} not found`);
        await this.queueService.retryJob(id);
        return { message: 'Job retry initiated', jobId: id };
    }
    async removeJob(id: string) {
        const job = await this.queueService.getJob(id);
        if (!job)
            throw new Error(`Job ${id} not found`);
        await this.queueService.removeJob(id);
    }
    async addJob(body: unknown) {
        let options = body.options ?? {};
        if (body.priorityFactors) {
            const priority = this.prioritizationService.calculatePriority(body.priorityFactors);
            options = { ...options, ...this.prioritizationService.getJobOptions(priority) };
        }
        const job = await this.queueService.addJob(body.name, body.data, options);
        return { jobId: job.id, name: job.name, priority: job.opts.priority, status: 'queued' };
    }
    async addBulkJobs(body: unknown) {
        const jobs = await this.queueService.addBulkJobs(body.jobs);
        return { count: jobs.length, jobIds: jobs.map((j: unknown) => j.id) };
    }
    async scheduleJob(body: unknown) {
        const scheduledTime = new Date(body.scheduledTime);
        if (scheduledTime <= new Date())
            throw new Error('scheduledTime must be in the future');
        const jobId = await this.schedulerService.scheduleJob(body.name, body.data, scheduledTime, body.options);
        return { jobId, scheduledFor: body.scheduledTime, status: 'scheduled' };
    }
    async scheduleDelayedJob(body: unknown) {
        const jobId = await this.schedulerService.scheduleDelayedJob(body.name, body.data, body.delayMs, body.options);
        return { jobId, delayMs: body.delayMs, status: 'scheduled' };
    }
    async pauseQueue() {
        await this.queueService.pauseQueue();
        return { message: 'Queue paused', timestamp: new Date().toISOString() };
    }
    async resumeQueue() {
        await this.queueService.resumeQueue();
        return { message: 'Queue resumed', timestamp: new Date().toISOString() };
    }
    async cleanQueue(body: unknown) {
        await this.queueService.cleanQueue(body.grace, body.status);
        return { message: 'Queue cleaned', grace: body.grace ?? 5000, status: body.status ?? 'all' };
    }
    async getActiveCronJobs() {
        return { jobs: this.schedulerService.getActiveCronJobs() };
    }
}
// ─── Mock factories
function buildQueue(overrides: unknown = {}) {
    return {
        getWaitingCount: jest.fn().mockResolvedValue(0),
        getActiveCount: jest.fn().mockResolvedValue(0),
        getCompletedCount: jest.fn().mockResolvedValue(0),
        getFailedCount: jest.fn().mockResolvedValue(0),
        getDelayedCount: jest.fn().mockResolvedValue(0),
        getPausedCount: jest.fn().mockResolvedValue(0),
        getCompleted: jest.fn().mockResolvedValue([]),
        getFailed: jest.fn().mockResolvedValue([]),
        getActive: jest.fn().mockResolvedValue([]),
        ...overrides,
    };
}
function buildQueueService(overrides: unknown = {}) {
    return {
        addJob: jest.fn(),
        addBulkJobs: jest.fn(),
        getJob: jest.fn(),
        getJobMetrics: jest.fn(),
        removeJob: jest.fn(),
        retryJob: jest.fn(),
        pauseQueue: jest.fn(),
        resumeQueue: jest.fn(),
        cleanQueue: jest.fn(),
        emptyQueue: jest.fn(),
        getQueueCounts: jest.fn(),
        ...overrides,
    };
}
function buildPrioritizationService() {
    return {
        calculatePriority: jest.fn().mockReturnValue(3),
        getJobOptions: jest.fn().mockReturnValue({ priority: 3 }),
    };
}
function buildSchedulerService(overrides: unknown = {}) {
    return {
        scheduleJob: jest.fn(),
        scheduleDelayedJob: jest.fn(),
        getScheduledJobs: jest.fn(),
        cancelScheduledJob: jest.fn(),
        getActiveCronJobs: jest.fn().mockReturnValue([]),
        ...overrides,
    };
}
// ─── Tests: QueueMonitoringService
describe('QueueMonitoringService', () => {
    let queue: unknown;
    let service: QueueMonitoringService;
    beforeEach(() => {
        queue = buildQueue();
        service = new QueueMonitoringService(queue);
    });
    // getQueueMetrics
    describe('getQueueMetrics', () => {
        it('sums all state counts into total', async () => {
            queue.getWaitingCount.mockResolvedValue(10);
            queue.getActiveCount.mockResolvedValue(3);
            queue.getCompletedCount.mockResolvedValue(100);
            queue.getFailedCount.mockResolvedValue(5);
            queue.getDelayedCount.mockResolvedValue(2);
            queue.getPausedCount.mockResolvedValue(1);
            const m = await service.getQueueMetrics();
            expect(m.waiting).toBe(10);
            expect(m.active).toBe(3);
            expect(m.total).toBe(121);
        });
        it('includes a capturedAt unix timestamp', async () => {
            const before = Date.now();
            const m = await service.getQueueMetrics();
            expect(m.capturedAt).toBeGreaterThanOrEqual(before);
        });
        it('appends to history on each call', async () => {
            await service.getQueueMetrics();
            await service.getQueueMetrics();
            expect(service.getMetricsHistory()).toHaveLength(2);
        });
        it('caps history at 100 entries', async () => {
            for (let i = 0; i < 110; i++)
                await service.getQueueMetrics();
            expect(service.getMetricsHistory().length).toBeLessThanOrEqual(100);
        });
        it('calculates avgProcessingTime from completed jobs', async () => {
            const now = Date.now();
            queue.getCompleted.mockResolvedValue([
                { processedOn: now - 2000, finishedOn: now - 0 },
                { processedOn: now - 4000, finishedOn: now - 2000 },
            ]);
            const m = await service.getQueueMetrics();
            expect(m.avgProcessingTime).toBe(2000);
        });
        it('returns 0 avgProcessingTime when no completed jobs', async () => {
            queue.getCompleted.mockResolvedValue([]);
            const m = await service.getQueueMetrics();
            expect(m.avgProcessingTime).toBe(0);
        });
    });
    // Throughput calculation
    describe('throughput', () => {
        it('returns 0 on the very first snapshot', async () => {
            queue.getCompletedCount.mockResolvedValue(50);
            const m = await service.getQueueMetrics();
            expect(m.throughput).toBe(0);
        });
        it('computes jobs/min correctly between snapshots', async () => {
            queue.getCompletedCount.mockResolvedValue(0);
            await service.getQueueMetrics();
            // Wind back the first snapshot's timestamp by 60 seconds
            (service as unknown).metricsHistory[0].capturedAt = Date.now() - 60000;
            queue.getCompletedCount.mockResolvedValue(60);
            const m2 = await service.getQueueMetrics();
            // ~60 jobs in ~60 s → ~60 jobs/min
            expect(m2.throughput).toBeGreaterThanOrEqual(55);
            expect(m2.throughput).toBeLessThanOrEqual(65);
        });
        it('never returns negative throughput if completed count drops', async () => {
            queue.getCompletedCount.mockResolvedValue(200);
            await service.getQueueMetrics();
            queue.getCompletedCount.mockResolvedValue(0); // reset after clean
            const m2 = await service.getQueueMetrics();
            expect(m2.throughput).toBeGreaterThanOrEqual(0);
        });
    });
    // checkQueueHealth
    describe('checkQueueHealth', () => {
        it('returns healthy when all counts are zero', async () => {
            const h = await service.checkQueueHealth();
            expect(h.status).toBe('healthy');
            expect(h.issues).toHaveLength(0);
        });
        it('returns warning for failure rate between 10% and 20%', async () => {
            queue.getCompletedCount.mockResolvedValue(85);
            queue.getFailedCount.mockResolvedValue(15); // 15% of 100
            const h = await service.checkQueueHealth();
            expect(h.status).toBe('warning');
            expect(h.issues.some((i) => i.includes('failure rate'))).toBe(true);
        });
        it('returns critical for failure rate above 20%', async () => {
            queue.getCompletedCount.mockResolvedValue(70);
            queue.getFailedCount.mockResolvedValue(30); // 30%
            const h = await service.checkQueueHealth();
            expect(h.status).toBe('critical');
        });
        it('returns warning for backlog between 1000 and 5000', async () => {
            queue.getWaitingCount.mockResolvedValue(2000);
            const h = await service.checkQueueHealth();
            expect(h.status).toBe('warning');
            expect(h.issues.some((i) => i.includes('backlog'))).toBe(true);
        });
        it('returns critical for backlog > 5000', async () => {
            queue.getWaitingCount.mockResolvedValue(6000);
            const h = await service.checkQueueHealth();
            expect(h.status).toBe('critical');
        });
        it('detects stalled queue (waiting > 0, active = 0, throughput = 0)', async () => {
            queue.getWaitingCount.mockResolvedValue(50);
            queue.getActiveCount.mockResolvedValue(0);
            const h = await service.checkQueueHealth();
            expect(h.issues.some((i) => i.toLowerCase().includes('stall'))).toBe(true);
        });
        it('includes timestamp in every response', async () => {
            const h = await service.checkQueueHealth();
            expect(h.timestamp).toBeInstanceOf(Date);
        });
        it('includes metrics snapshot in response', async () => {
            const h = await service.checkQueueHealth();
            expect(h.metrics).toBeDefined();
            expect(h.metrics.queueName).toBe('default');
        });
    });
    // getFailedJobs
    describe('getFailedJobs', () => {
        it('calls queue.getFailed with correct start/end for pagination', async () => {
            queue.getFailed.mockResolvedValue([]);
            await service.getFailedJobs(10, 20);
            expect(queue.getFailed).toHaveBeenCalledWith(20, 29);
        });
        it('filters by jobName when provided', async () => {
            queue.getFailed.mockResolvedValue([
                { id: '1', name: 'email', finishedOn: Date.now() },
                { id: '2', name: 'backup', finishedOn: Date.now() },
                { id: '3', name: 'email', finishedOn: Date.now() },
            ]);
            const results = await service.getFailedJobs(50, 0, 'email');
            expect(results).toHaveLength(2);
            expect(results.every((r: unknown) => r.name === 'email')).toBe(true);
        });
        it('applies pagination after filtering', async () => {
            const jobs = Array.from({ length: 10 }, (_, i) => ({
                id: String(i),
                name: 'email',
                finishedOn: Date.now(),
            }));
            queue.getFailed.mockResolvedValue(jobs);
            const results = await service.getFailedJobs(3, 2, 'email');
            expect(results).toHaveLength(3);
            expect(results[0].id).toBe('2');
        });
        it('uses default limit=50 offset=0', async () => {
            queue.getFailed.mockResolvedValue([]);
            await service.getFailedJobs();
            expect(queue.getFailed).toHaveBeenCalledWith(0, 49);
        });
    });
    // retryAllFailedJobs
    describe('retryAllFailedJobs', () => {
        it('returns correct counts when all retries succeed', async () => {
            const retryFn = jest.fn().mockResolvedValue(undefined);
            queue.getFailed.mockResolvedValue([
                { id: '1', retry: retryFn },
                { id: '2', retry: retryFn },
            ]);
            const result = await service.retryAllFailedJobs();
            expect(result.requeued).toBe(2);
            expect(result.skipped).toBe(0);
            expect(result.errors).toHaveLength(0);
        });
        it('tracks errors for jobs that fail to retry', async () => {
            queue.getFailed.mockResolvedValue([
                { id: '1', retry: jest.fn().mockResolvedValue(undefined) },
                { id: '2', retry: jest.fn().mockRejectedValue(new Error('locked')) },
                { id: '3', retry: jest.fn().mockRejectedValue(new Error('gone')) },
            ]);
            const result = await service.retryAllFailedJobs();
            expect(result.requeued).toBe(1);
            expect(result.skipped).toBe(2);
            expect(result.errors[0].jobId).toBe('2');
            expect(result.errors[1].reason).toBe('gone');
        });
        it('handles empty failed list gracefully', async () => {
            queue.getFailed.mockResolvedValue([]);
            const result = await service.retryAllFailedJobs();
            expect(result.requeued).toBe(0);
            expect(result.skipped).toBe(0);
            expect(result.errors).toHaveLength(0);
        });
    });
    // getStuckJobs
    describe('getStuckJobs', () => {
        it('returns jobs active longer than threshold', async () => {
            const now = Date.now();
            queue.getActive.mockResolvedValue([
                { id: '1', processedOn: now - 400000 }, // stuck
                { id: '2', processedOn: now - 100000 }, // fine
                { id: '3', processedOn: now - 600000 }, // stuck
            ]);
            const stuck = await service.getStuckJobs(300000);
            expect(stuck).toHaveLength(2);
            const ids = stuck.map((j: unknown) => j.id);
            expect(ids).toContain('1');
            expect(ids).toContain('3');
        });
        it('returns empty array when all active jobs are within threshold', async () => {
            queue.getActive.mockResolvedValue([{ id: '1', processedOn: Date.now() - 1000 }]);
            const stuck = await service.getStuckJobs(300000);
            expect(stuck).toHaveLength(0);
        });
        it('falls back to job.timestamp when processedOn is null', async () => {
            const now = Date.now();
            queue.getActive.mockResolvedValue([
                { id: '99', processedOn: null, timestamp: now - 999000 },
            ]);
            const stuck = await service.getStuckJobs(300000);
            expect(stuck).toHaveLength(1);
            expect(stuck[0].id).toBe('99');
        });
        it('returns zero stuck jobs for an empty active list', async () => {
            queue.getActive.mockResolvedValue([]);
            const stuck = await service.getStuckJobs(300000);
            expect(stuck).toHaveLength(0);
        });
    });
    // getRetryAnalytics
    describe('getRetryAnalytics', () => {
        const now = Date.now();
        const recentFailed = [
            {
                id: 'f1',
                name: 'send-email',
                finishedOn: now - 1000,
                timestamp: now - 5000,
                attemptsMade: 3,
                opts: { attempts: 3 },
            },
            {
                id: 'f2',
                name: 'send-email',
                finishedOn: now - 2000,
                timestamp: now - 6000,
                attemptsMade: 2,
                opts: { attempts: 3 },
            },
            {
                id: 'f3',
                name: 'backup',
                finishedOn: now - 3000,
                timestamp: now - 7000,
                attemptsMade: 1,
                opts: { attempts: 3 },
            },
        ];
        const recentCompleted = [
            {
                id: 'c1',
                name: 'send-email',
                finishedOn: now - 500,
                timestamp: now - 3000,
                attemptsMade: 2,
                opts: { attempts: 3 },
            },
        ];
        beforeEach(() => {
            queue.getFailed.mockResolvedValue(recentFailed);
            queue.getCompleted.mockResolvedValue(recentCompleted);
        });
        it('counts total failed correctly', async () => {
            const a = await service.getRetryAnalytics(60);
            expect(a.totalFailed).toBe(3);
        });
        it('counts retried jobs (attemptsMade > 1)', async () => {
            const a = await service.getRetryAnalytics(60);
            expect(a.totalRetried).toBe(2); // f1 and f2
        });
        it('counts permanently failed jobs (attempts >= maxAttempts)', async () => {
            const a = await service.getRetryAnalytics(60);
            expect(a.permanentlyFailed).toBe(1); // only f1 (3/3)
        });
        it('counts success-after-retry from completed jobs', async () => {
            const a = await service.getRetryAnalytics(60);
            expect(a.successAfterRetry).toBe(1); // c1 had attemptsMade=2
        });
        it('computes retry rate as fraction of failed that were retried', async () => {
            const a = await service.getRetryAnalytics(60);
            expect(a.retryRate).toBeCloseTo(2 / 3, 2);
        });
        it('produces per-job-type breakdown', async () => {
            const a = await service.getRetryAnalytics(60);
            expect(a.byJobType['send-email']).toBeDefined();
            expect(a.byJobType['backup']).toBeDefined();
            expect(a.byJobType['send-email'].failed).toBeGreaterThan(0);
        });
        it('excludes jobs outside the time window', async () => {
            const old = {
                id: 'old',
                name: 'stale-job',
                finishedOn: now - 7200000,
                timestamp: now - 7200000,
                attemptsMade: 1,
                opts: {},
            };
            queue.getFailed.mockResolvedValue([...recentFailed, old]);
            const a = await service.getRetryAnalytics(60);
            expect(a.totalFailed).toBe(3); // old excluded
            expect(a.byJobType['stale-job']).toBeUndefined();
        });
        it('returns all-zeros when there are no recent failures', async () => {
            queue.getFailed.mockResolvedValue([]);
            queue.getCompleted.mockResolvedValue([]);
            const a = await service.getRetryAnalytics(60);
            expect(a.totalFailed).toBe(0);
            expect(a.retryRate).toBe(0);
            expect(a.successAfterRetryRate).toBe(0);
        });
        it('respects custom windowMinutes', async () => {
            const a = await service.getRetryAnalytics(30);
            expect(a.windowMinutes).toBe(30);
        });
    });
    // getMetricsHistory
    describe('getMetricsHistory', () => {
        it('returns empty array before any snapshots', () => {
            expect(service.getMetricsHistory()).toHaveLength(0);
        });
        it('returns a copy — mutations do not affect internal state', async () => {
            await service.getQueueMetrics();
            const h = service.getMetricsHistory();
            h.push({} as unknown);
            expect(service.getMetricsHistory()).toHaveLength(1);
        });
        it('each entry has capturedAt', async () => {
            await service.getQueueMetrics();
            await service.getQueueMetrics();
            service.getMetricsHistory().forEach((m) => {
                expect(typeof m.capturedAt).toBe('number');
                expect(m.capturedAt).toBeGreaterThan(0);
            });
        });
    });
    // getQueueStatistics
    describe('getQueueStatistics', () => {
        it('returns current, trends, and health keys', async () => {
            const s = await service.getQueueStatistics();
            expect(s).toHaveProperty('current');
            expect(s).toHaveProperty('trends');
            expect(s).toHaveProperty('health');
            expect(s.trends).toHaveProperty('completed');
            expect(s.trends).toHaveProperty('failed');
            expect(s.trends).toHaveProperty('throughput');
        });
        it('trend is stable with a single data point', async () => {
            const s = await service.getQueueStatistics();
            expect(s.trends.completed).toBe('stable');
        });
        it('trend is up when completed counts rise', async () => {
            // Pre-seed history with a clear upward ramp: 0, 100, 200 ... 1000
            const history = (service as unknown).metricsHistory as unknown[];
            for (let i = 0; i < 11; i++) {
                history.push({
                    queueName: 'default',
                    completed: i * 100,
                    failed: 0,
                    throughput: 0,
                    capturedAt: Date.now() - (10 - i) * 60000,
                    waiting: 0,
                    active: 0,
                    delayed: 0,
                    paused: 0,
                    total: 0,
                    avgProcessingTime: 0,
                });
            }
            // The live snapshot appended by getQueueMetrics must continue the rise.
            // Mock a value clearly above the 10-entry window average (~500).
            queue.getCompletedCount.mockResolvedValue(1500);
            const s = await service.getQueueStatistics();
            expect(s.trends.completed).toBe('up');
        });
        it('trend is down when completed counts fall', async () => {
            const history = (service as unknown).metricsHistory as unknown[];
            for (let i = 0; i < 11; i++) {
                history.push({
                    queueName: 'default',
                    completed: (10 - i) * 100,
                    failed: 0,
                    throughput: 0,
                    capturedAt: Date.now() - (10 - i) * 60000,
                    waiting: 0,
                    active: 0,
                    delayed: 0,
                    paused: 0,
                    total: 0,
                    avgProcessingTime: 0,
                });
            }
            const s = await service.getQueueStatistics();
            expect(s.trends.completed).toBe('down');
        });
    });
});
// ─── Tests: QueueController
describe('QueueController', () => {
    let queueService: unknown;
    let prioritizationService: unknown;
    let schedulerService: unknown;
    let monitoringService: QueueMonitoringService;
    let controller: QueueController;
    let queue: unknown;
    beforeEach(() => {
        queue = buildQueue();
        queueService = buildQueueService();
        prioritizationService = buildPrioritizationService();
        schedulerService = buildSchedulerService();
        monitoringService = new QueueMonitoringService(queue);
        controller = new QueueController(queueService, prioritizationService, schedulerService, monitoringService);
    });
    // Monitoring endpoints
    describe('getMetrics', () => {
        it('returns metrics from monitoring service', async () => {
            const m = await controller.getMetrics();
            expect(m.queueName).toBe('default');
        });
    });
    describe('getHealth', () => {
        it('returns health status object', async () => {
            const h = await controller.getHealth();
            expect(['healthy', 'warning', 'critical']).toContain(h.status);
            expect(Array.isArray(h.issues)).toBe(true);
        });
    });
    describe('getCounts', () => {
        it('delegates to queueService.getQueueCounts', async () => {
            queueService.getQueueCounts.mockResolvedValue({ waiting: 5 });
            const result = await controller.getCounts();
            expect(result).toEqual({ waiting: 5 });
        });
    });
    describe('getMetricsHistory', () => {
        it('returns wrapped history array', async () => {
            const result = await controller.getMetricsHistory();
            expect(result).toHaveProperty('history');
            expect(Array.isArray(result.history)).toBe(true);
        });
    });
    describe('getRetryAnalytics', () => {
        it('uses 60 as default windowMinutes', async () => {
            queue.getFailed.mockResolvedValue([]);
            queue.getCompleted.mockResolvedValue([]);
            const result = await controller.getRetryAnalytics({ windowMinutes: undefined });
            expect(result.windowMinutes).toBe(60);
        });
        it('passes custom windowMinutes', async () => {
            queue.getFailed.mockResolvedValue([]);
            queue.getCompleted.mockResolvedValue([]);
            const result = await controller.getRetryAnalytics({ windowMinutes: 30 });
            expect(result.windowMinutes).toBe(30);
        });
    });
    // Failed jobs
    describe('getFailedJobs', () => {
        const now = Date.now();
        const failedJob = {
            id: '1',
            name: 'email',
            data: {},
            failedReason: 'timeout',
            attemptsMade: 2,
            opts: { attempts: 3 },
            stacktrace: ['at ...'],
            timestamp: now - 10000,
            processedOn: now - 8000,
            finishedOn: now - 5000,
        };
        beforeEach(() => {
            queue.getFailed.mockResolvedValue([failedJob]);
        });
        it('shapes response with data and meta', async () => {
            const result = await controller.getFailedJobs({ limit: 50, offset: 0 });
            expect(result.data).toHaveLength(1);
            expect(result.data[0].id).toBe('1');
            expect(result.data[0].maxAttempts).toBe(3);
            expect(result.data[0].stackTrace).toEqual(['at ...']);
            expect(result.meta.limit).toBe(50);
        });
        it('null processedOn/finishedOn when absent', async () => {
            queue.getFailed.mockResolvedValue([{ ...failedJob, processedOn: null, finishedOn: null }]);
            const result = await controller.getFailedJobs({});
            expect(result.data[0].processedOn).toBeNull();
            expect(result.data[0].finishedOn).toBeNull();
        });
    });
    describe('retryAllFailedJobs', () => {
        it('returns bulk retry summary', async () => {
            queue.getFailed.mockResolvedValue([
                { id: '1', retry: jest.fn().mockResolvedValue(undefined) },
            ]);
            const result = await controller.retryAllFailedJobs();
            expect(result.requeued).toBe(1);
        });
    });
    // Stuck jobs
    describe('getStuckJobs', () => {
        it('uses 300000 as default threshold', async () => {
            queue.getActive.mockResolvedValue([]);
            const result = await controller.getStuckJobs({});
            expect(result.thresholdMs).toBe(300000);
        });
        it('shapes stuck-job entries correctly', async () => {
            const now = Date.now();
            queue.getActive.mockResolvedValue([
                {
                    id: 'x',
                    name: 'backup',
                    data: {},
                    processedOn: now - 400000,
                    attemptsMade: 1,
                    opts: { priority: 3 },
                },
            ]);
            const result = await controller.getStuckJobs({ threshold: 300000 });
            expect(result.data).toHaveLength(1);
            expect(result.data[0].id).toBe('x');
            expect(result.data[0].activeForMs).toBeGreaterThan(0);
        });
    });
    // Per-job CRUD
    describe('getJob', () => {
        it('returns metrics for existing job', async () => {
            queueService.getJobMetrics.mockResolvedValue({ jobId: '42', status: 'completed' });
            const result = await controller.getJob('42');
            expect(result.jobId).toBe('42');
        });
        it('throws when job not found', async () => {
            queueService.getJobMetrics.mockResolvedValue(null);
            await expect(controller.getJob('missing')).rejects.toThrow('Job missing not found');
        });
    });
    describe('retryJob', () => {
        it('retries an existing failed job', async () => {
            queueService.getJob.mockResolvedValue({ id: '1' });
            queueService.retryJob.mockResolvedValue(undefined);
            const result = await controller.retryJob('1');
            expect(result.message).toBe('Job retry initiated');
            expect(result.jobId).toBe('1');
        });
        it('throws when job not found', async () => {
            queueService.getJob.mockResolvedValue(null);
            await expect(controller.retryJob('ghost')).rejects.toThrow();
        });
    });
    describe('removeJob', () => {
        it('removes an existing job', async () => {
            queueService.getJob.mockResolvedValue({ id: '1' });
            queueService.removeJob.mockResolvedValue(undefined);
            await expect(controller.removeJob('1')).resolves.toBeUndefined();
        });
        it('throws when job not found', async () => {
            queueService.getJob.mockResolvedValue(null);
            await expect(controller.removeJob('ghost')).rejects.toThrow();
        });
    });
    // Job submission
    describe('addJob', () => {
        it('adds job without priority factors', async () => {
            queueService.addJob.mockResolvedValue({ id: 'j1', name: 'email', opts: { priority: 3 } });
            const result = await controller.addJob({ name: 'email', data: {} });
            expect(result.jobId).toBe('j1');
            expect(result.status).toBe('queued');
            expect(prioritizationService.calculatePriority).not.toHaveBeenCalled();
        });
        it('calculates priority when factors are supplied', async () => {
            queueService.addJob.mockResolvedValue({ id: 'j2', name: 'payment', opts: { priority: 1 } });
            await controller.addJob({
                name: 'payment',
                data: {},
                priorityFactors: { urgency: 'critical' },
            });
            expect(prioritizationService.calculatePriority).toHaveBeenCalledWith({ urgency: 'critical' });
            expect(prioritizationService.getJobOptions).toHaveBeenCalledWith(3);
        });
    });
    describe('addBulkJobs', () => {
        it('returns count and jobIds', async () => {
            queueService.addBulkJobs.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
            const result = await controller.addBulkJobs({ jobs: [{}, {}] });
            expect(result.count).toBe(2);
            expect(result.jobIds).toEqual(['a', 'b']);
        });
    });
    describe('scheduleJob', () => {
        it('throws for a past scheduledTime', async () => {
            const past = new Date(Date.now() - 10000).toISOString();
            await expect(controller.scheduleJob({ name: 'x', data: {}, scheduledTime: past })).rejects.toThrow();
        });
        it('schedules a future job', async () => {
            schedulerService.scheduleJob.mockResolvedValue('sched-1');
            const future = new Date(Date.now() + 60000).toISOString();
            const result = await controller.scheduleJob({
                name: 'report',
                data: {},
                scheduledTime: future,
            });
            expect(result.jobId).toBe('sched-1');
            expect(result.status).toBe('scheduled');
        });
    });
    describe('scheduleDelayedJob', () => {
        it('delegates to scheduler and returns jobId', async () => {
            schedulerService.scheduleDelayedJob.mockResolvedValue('delayed-1');
            const result = await controller.scheduleDelayedJob({ name: 'x', data: {}, delayMs: 5000 });
            expect(result.jobId).toBe('delayed-1');
            expect(result.delayMs).toBe(5000);
        });
    });
    // Queue controls
    describe('pauseQueue', () => {
        it('calls queueService.pauseQueue and returns confirmation', async () => {
            queueService.pauseQueue.mockResolvedValue(undefined);
            const result = await controller.pauseQueue();
            expect(result.message).toBe('Queue paused');
            expect(result.timestamp).toBeDefined();
        });
    });
    describe('resumeQueue', () => {
        it('calls queueService.resumeQueue and returns confirmation', async () => {
            queueService.resumeQueue.mockResolvedValue(undefined);
            const result = await controller.resumeQueue();
            expect(result.message).toBe('Queue resumed');
        });
    });
    describe('cleanQueue', () => {
        it('delegates grace and status to queueService', async () => {
            queueService.cleanQueue.mockResolvedValue(undefined);
            await controller.cleanQueue({ grace: 10000, status: 'failed' });
            expect(queueService.cleanQueue).toHaveBeenCalledWith(10000, 'failed');
        });
        it('returns cleaned confirmation message', async () => {
            queueService.cleanQueue.mockResolvedValue(undefined);
            const result = await controller.cleanQueue({ grace: 5000 });
            expect(result.message).toBe('Queue cleaned');
        });
    });
    describe('getActiveCronJobs', () => {
        it('returns wrapped list of cron names', async () => {
            schedulerService.getActiveCronJobs.mockReturnValue(['daily-cleanup', 'hourly-metrics']);
            const result = await controller.getActiveCronJobs();
            expect(result.jobs).toEqual(['daily-cleanup', 'hourly-metrics']);
        });
    });
});
