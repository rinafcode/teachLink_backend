import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Observable, Subject, interval, BehaviorSubject } from 'rxjs';
import { QueueService } from '../queue.service';
import { Job, JobStatus } from '../interfaces/job.interface';

/**
 * Alert severity levels
 */
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Alert types
 */
export enum AlertType {
  HIGH_ERROR_RATE = 'high_error_rate',
  QUEUE_GROWTH = 'queue_growth',
  PROCESSING_DELAY = 'processing_delay',
  STALLED_JOBS = 'stalled_jobs',
  HIGH_MEMORY_USAGE = 'high_memory_usage',
  HIGH_CPU_USAGE = 'high_cpu_usage',
  THROUGHPUT_DROP = 'throughput_drop',
  JOB_TIMEOUT = 'job_timeout',
}

/**
 * Alert interface
 */
export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  timestamp: Date;
  jobId?: string;
  jobName?: string;
  metric?: string;
  value?: number;
  threshold?: number;
}

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  enabled: boolean;
  sampleInterval: number; // milliseconds
  retentionPeriod: number; // milliseconds
  alertThresholds: {
    maxErrorRate: number; // percentage
    maxQueueSize: number;
    maxProcessingTime: number; // milliseconds
    maxLatency: number; // milliseconds
    stalledJobThreshold: number; // milliseconds
    throughputDropThreshold: number; // percentage
  };
}

/**
 * Queue metrics
 */
export interface QueueMetrics {
  timestamp: Date;
  queueSize: number;
  processingCount: number;
  completedCount: number;
  failedCount: number;
  errorRate: number;
  averageProcessingTime: number;
  throughput: number; // jobs per minute
  latency: number; // milliseconds
  oldestJobAge: number; // milliseconds
  memoryUsage: number; // bytes
  cpuUsage: number; // percentage
}

/**
 * Service for monitoring queue health and performance
 */
@Injectable()
export class QueueMonitoringService implements OnModuleInit {
  private readonly logger = new Logger(QueueMonitoringService.name);
  private config: MonitoringConfig = {
    enabled: true,
    sampleInterval: 60000, // 1 minute
    retentionPeriod: 86400000, // 24 hours
    alertThresholds: {
      maxErrorRate: 10, // 10%
      maxQueueSize: 1000,
      maxProcessingTime: 30000, // 30 seconds
      maxLatency: 5000, // 5 seconds
      stalledJobThreshold: 300000, // 5 minutes
      throughputDropThreshold: 50, // 50%
    },
  };

  private metrics: QueueMetrics[] = [];
  private alerts: Alert[] = [];
  private metricsSubject = new BehaviorSubject<QueueMetrics | null>(null);
  private alertsSubject = new Subject<Alert>();
  
  // Performance tracking
  private processingTimes: number[] = [];
  private completedJobs = 0;
  private failedJobs = 0;
  private lastThroughput = 0;
  private lastSampleTime = Date.now();

  constructor(private readonly queueService: QueueService) {
    // Subscribe to job events
    this.queueService.onCompleted().subscribe(job => {
      this.trackCompletedJob(job);
    });

    this.queueService.onFailed().subscribe(job => {
      this.trackFailedJob(job);
    });
  }

  /**
   * Initialize monitoring when module starts
   */
  onModuleInit() {
    if (this.config.enabled) {
      this.startMonitoring();
    }
  }

  /**
   * Set monitoring configuration
   */
  setConfig(config: Partial<MonitoringConfig>): void {
    const wasEnabled = this.config.enabled;
    
    this.config = {
      ...this.config,
      ...config,
      alertThresholds: {
        ...this.config.alertThresholds,
        ...config.alertThresholds,
      },
    };
    
    // Start or stop monitoring based on enabled flag
    if (!wasEnabled && this.config.enabled) {
      this.startMonitoring();
    } else if (wasEnabled && !this.config.enabled) {
      this.stopMonitoring();
    }
    
    this.logger.log(`Monitoring configuration updated, enabled: ${this.config.enabled}`);
  }

  /**
   * Get current monitoring configuration
   */
  getConfig(): MonitoringConfig {
    return { ...this.config };
  }

  /**
   * Start the monitoring process
   */
  private startMonitoring(): void {
    this.logger.log('Starting queue monitoring');
    
    // Set up interval for collecting metrics
    interval(this.config.sampleInterval).subscribe(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        this.logger.error('Error collecting metrics', error);
      }
    });
  }

  /**
   * Stop the monitoring process
   */
  private stopMonitoring(): void {
    this.logger.log('Stopping queue monitoring');
    // Interval subscription will be garbage collected
  }

  /**
   * Collect current queue metrics
   */
  private async collectMetrics(): Promise<void> {
    const now = Date.now();
    const timeSinceLastSample = now - this.lastSampleTime;
    
    // Get current queue stats
    const pendingJobs = await this.queueService.getJobs(JobStatus.PENDING, 1000, 0);
    const processingJobs = await this.queueService.getJobs(JobStatus.PROCESSING, 1000, 0);
    
    // Calculate metrics
    const queueSize = pendingJobs.length;
    const processingCount = processingJobs.length;
    
    // Calculate error rate
    const totalJobs = this.completedJobs + this.failedJobs || 1; // Avoid division by zero
    const errorRate = (this.failedJobs / totalJobs) * 100;
    
    // Calculate average processing time
    const avgProcessingTime = this.processingTimes.length > 0 ?
      this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length :
      0;
    
    // Calculate throughput (jobs per minute)
    const throughput = ((this.completedJobs + this.failedJobs) / timeSinceLastSample) * 60000;
    
    // Calculate latency (average wait time for pending jobs)
    let totalLatency = 0;
    let oldestJobAge = 0;
    
    for (const job of pendingJobs) {
      const waitTime = now - job.createdAt.getTime();
      totalLatency += waitTime;
      oldestJobAge = Math.max(oldestJobAge, waitTime);
    }
    
    const latency = pendingJobs.length > 0 ? totalLatency / pendingJobs.length : 0;
    
    // Get system resource usage
    const memoryUsage = process.memoryUsage().heapUsed;
    const cpuUsage = 0; // Would require additional library to measure accurately
    
    // Create metrics object
    const metrics: QueueMetrics = {
      timestamp: new Date(),
      queueSize,
      processingCount,
      completedCount: this.completedJobs,
      failedCount: this.failedJobs,
      errorRate,
      averageProcessingTime: avgProcessingTime,
      throughput,
      latency,
      oldestJobAge,
      memoryUsage,
      cpuUsage,
    };
    
    // Store metrics
    this.metrics.push(metrics);
    
    // Emit metrics update
    this.metricsSubject.next(metrics);
    
    // Check for alerts
    this.checkAlerts(metrics);
    
    // Reset counters for next interval
    this.completedJobs = 0;
    this.failedJobs = 0;
    this.lastThroughput = throughput;
    this.lastSampleTime = now;
    
    // Trim old metrics
    this.pruneMetricsHistory();
    
    this.logger.debug('Metrics collected', metrics);
  }

  /**
   * Check for alert conditions
   */
  private checkAlerts(metrics: QueueMetrics): void {
    const thresholds = this.config.alertThresholds;
    
    // Check error rate
    if (metrics.errorRate > thresholds.maxErrorRate) {
      this.createAlert({
        type: AlertType.HIGH_ERROR_RATE,
        severity: metrics.errorRate > thresholds.maxErrorRate * 2 ? AlertSeverity.ERROR : AlertSeverity.WARNING,
        message: `High error rate: ${metrics.errorRate.toFixed(2)}% (threshold: ${thresholds.maxErrorRate}%)`,
        metric: 'errorRate',
        value: metrics.errorRate,
        threshold: thresholds.maxErrorRate,
      });
    }
    
    // Check queue size
    if (metrics.queueSize > thresholds.maxQueueSize) {
      this.createAlert({
        type: AlertType.QUEUE_GROWTH,
        severity: metrics.queueSize > thresholds.maxQueueSize * 2 ? AlertSeverity.ERROR : AlertSeverity.WARNING,
        message: `Queue size growing: ${metrics.queueSize} jobs (threshold: ${thresholds.maxQueueSize})`,
        metric: 'queueSize',
        value: metrics.queueSize,
        threshold: thresholds.maxQueueSize,
      });
    }
    
    // Check processing time
    if (metrics.averageProcessingTime > thresholds.maxProcessingTime) {
      this.createAlert({
        type: AlertType.PROCESSING_DELAY,
        severity: metrics.averageProcessingTime > thresholds.maxProcessingTime * 2 ? AlertSeverity.ERROR : AlertSeverity.WARNING,
        message: `Slow job processing: ${(metrics.averageProcessingTime / 1000).toFixed(2)}s (threshold: ${(thresholds.maxProcessingTime / 1000).toFixed(2)}s)`,
        metric: 'averageProcessingTime',
        value: metrics.averageProcessingTime,
        threshold: thresholds.maxProcessingTime,
      });
    }
    
    // Check latency
    if (metrics.latency > thresholds.maxLatency) {
      this.createAlert({
        type: AlertType.PROCESSING_DELAY,
        severity: metrics.latency > thresholds.maxLatency * 2 ? AlertSeverity.ERROR : AlertSeverity.WARNING,
        message: `High queue latency: ${(metrics.latency / 1000).toFixed(2)}s (threshold: ${(thresholds.maxLatency / 1000).toFixed(2)}s)`,
        metric: 'latency',
        value: metrics.latency,
        threshold: thresholds.maxLatency,
      });
    }
    
    // Check for stalled jobs
    if (metrics.oldestJobAge > thresholds.stalledJobThreshold) {
      this.createAlert({
        type: AlertType.STALLED_JOBS,
        severity: metrics.oldestJobAge > thresholds.stalledJobThreshold * 2 ? AlertSeverity.ERROR : AlertSeverity.WARNING,
        message: `Stalled jobs detected: oldest job waiting for ${(metrics.oldestJobAge / 60000).toFixed(2)} minutes`,
        metric: 'oldestJobAge',
        value: metrics.oldestJobAge,
        threshold: thresholds.stalledJobThreshold,
      });
    }
    
    // Check for throughput drop
    if (this.lastThroughput > 0 && metrics.throughput > 0) {
      const throughputDrop = ((this.lastThroughput - metrics.throughput) / this.lastThroughput) * 100;
      
      if (throughputDrop > thresholds.throughputDropThreshold) {
        this.createAlert({
          type: AlertType.THROUGHPUT_DROP,
          severity: throughputDrop > thresholds.throughputDropThreshold * 2 ? AlertSeverity.ERROR : AlertSeverity.WARNING,
          message: `Throughput dropped by ${throughputDrop.toFixed(2)}% (threshold: ${thresholds.throughputDropThreshold}%)`,
          metric: 'throughput',
          value: throughputDrop,
          threshold: thresholds.throughputDropThreshold,
        });
      }
    }
  }

  /**
   * Create and emit an alert
   */
  private createAlert(alertData: Partial<Alert>): void {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      severity: alertData.severity || AlertSeverity.WARNING,
      type: alertData.type || AlertType.HIGH_ERROR_RATE,
      message: alertData.message || 'Queue alert',
      jobId: alertData.jobId,
      jobName: alertData.jobName,
      metric: alertData.metric,
      value: alertData.value,
      threshold: alertData.threshold,
    };
    
    this.alerts.push(alert);
    this.alertsSubject.next(alert);
    
    this.logger.warn(`Queue alert: ${alert.message}`, { alertId: alert.id, type: alert.type });
    
    // Prune old alerts
    this.pruneAlertHistory();
  }

  /**
   * Track completed job for metrics
   */
  private trackCompletedJob(job: Job): void {
    this.completedJobs++;
    
    // Track processing time if we have timing data
    if (job.lastAttemptedAt) {
      const processingTime = Date.now() - job.lastAttemptedAt.getTime();
      this.processingTimes.push(processingTime);
      
      // Keep only the last 1000 processing times
      if (this.processingTimes.length > 1000) {
        this.processingTimes.shift();
      }
      
      // Check for job timeout
      if (job.options?.timeout && processingTime > job.options.timeout) {
        this.createAlert({
          type: AlertType.JOB_TIMEOUT,
          severity: AlertSeverity.WARNING,
          message: `Job ${job.id} (${job.name}) exceeded timeout: ${(processingTime / 1000).toFixed(2)}s vs ${(job.options.timeout / 1000).toFixed(2)}s`,
          jobId: job.id,
          jobName: job.name,
          metric: 'processingTime',
          value: processingTime,
          threshold: job.options.timeout,
        });
      }
    }
  }

  /**
   * Track failed job for metrics
   */
  private trackFailedJob(job: Job): void {
    this.failedJobs++;
  }

  /**
   * Remove old metrics based on retention period
   */
  private pruneMetricsHistory(): void {
    const cutoff = Date.now() - this.config.retentionPeriod;
    this.metrics = this.metrics.filter(metric => metric.timestamp.getTime() > cutoff);
  }

  /**
   * Remove old alerts based on retention period
   */
  private pruneAlertHistory(): void {
    const cutoff = Date.now() - this.config.retentionPeriod;
    this.alerts = this.alerts.filter(alert => alert.timestamp.getTime() > cutoff);
  }

  /**
   * Get current queue metrics
   */
  getCurrentMetrics(): QueueMetrics | null {
    return this.metricsSubject.getValue();
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(limit: number = 100): QueueMetrics[] {
    return this.metrics.slice(-limit);
  }

  /**
   * Get recent alerts
   */
  getAlerts(limit: number = 100): Alert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * Get alerts by type
   */
  getAlertsByType(type: AlertType, limit: number = 100): Alert[] {
    return this.alerts
      .filter(alert => alert.type === type)
      .slice(-limit);
  }

  /**
   * Get alerts by severity
   */
  getAlertsBySeverity(severity: AlertSeverity, limit: number = 100): Alert[] {
    return this.alerts
      .filter(alert => alert.severity === severity)
      .slice(-limit);
  }

  /**
   * Subscribe to metrics updates
   */
  onMetricsUpdate(): Observable<QueueMetrics | null> {
    return this.metricsSubject.asObservable();
  }

  /**
   * Subscribe to new alerts
   */
  onAlert(): Observable<Alert> {
    return this.alertsSubject.asObservable();
  }

  /**
   * Get health status summary
   */
  getHealthStatus(): Record<string, any> {
    const currentMetrics = this.getCurrentMetrics();
    
    if (!currentMetrics) {
      return { status: 'unknown', message: 'No metrics available yet' };
    }
    
    const thresholds = this.config.alertThresholds;
    let status = 'healthy';
    const issues = [];
    
    // Check error rate
    if (currentMetrics.errorRate > thresholds.maxErrorRate) {
      status = currentMetrics.errorRate > thresholds.maxErrorRate * 2 ? 'critical' : 'warning';
      issues.push(`High error rate: ${currentMetrics.errorRate.toFixed(2)}%`);
    }
    
    // Check queue size
    if (currentMetrics.queueSize > thresholds.maxQueueSize) {
      status = status === 'healthy' ? 'warning' : status;
      issues.push(`Large queue size: ${currentMetrics.queueSize} jobs`);
    }
    
    // Check latency
    if (currentMetrics.latency > thresholds.maxLatency) {
      status = status === 'healthy' ? 'warning' : status;
      issues.push(`High latency: ${(currentMetrics.latency / 1000).toFixed(2)}s`);
    }
    
    return {
      status,
      timestamp: currentMetrics.timestamp,
      queueSize: currentMetrics.queueSize,
      processingCount: currentMetrics.processingCount,
      errorRate: `${currentMetrics.errorRate.toFixed(2)}%`,
      throughput: `${currentMetrics.throughput.toFixed(2)} jobs/min`,
      latency: `${(currentMetrics.latency / 1000).toFixed(2)}s`,
      issues: issues.length > 0 ? issues : ['No issues detected'],
    };
  }
}