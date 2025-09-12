import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { QueueService } from '../queue.service';
import { QueueMonitoringService } from '../monitoring/queue-monitoring.service';
import { Job, JobStatus } from '../interfaces/job.interface';

/**
 * Optimization strategy types
 */
export enum OptimizationStrategy {
  CONCURRENCY_SCALING = 'concurrency_scaling',
  BATCHING = 'batching',
  THROTTLING = 'throttling',
  ADAPTIVE_TIMEOUT = 'adaptive_timeout',
  PRIORITY_BOOSTING = 'priority_boosting',
  LOAD_SHEDDING = 'load_shedding',
}

/**
 * Configuration for queue optimization
 */
export interface OptimizationConfig {
  enabled: boolean;
  strategies: OptimizationStrategy[];
  concurrencyLimits: {
    min: number;
    max: number;
    default: number;
  };
  batchingConfig: {
    enabled: boolean;
    maxBatchSize: number;
    batchWindow: number; // milliseconds
    jobTypes: string[];
  };
  throttlingConfig: {
    enabled: boolean;
    threshold: number; // jobs per second
    cooldown: number; // milliseconds
  };
  timeoutConfig: {
    enabled: boolean;
    baseTimeout: number; // milliseconds
    maxTimeout: number; // milliseconds
  };
  priorityBoostConfig: {
    enabled: boolean;
    ageThreshold: number; // milliseconds
    boostAmount: number;
  };
  loadSheddingConfig: {
    enabled: boolean;
    highWatermark: number; // queue size
    lowPriorityTypes: string[];
  };
}

/**
 * Service for optimizing queue performance
 */
@Injectable()
export class QueueOptimizationService implements OnModuleInit {
  private readonly logger = new Logger(QueueOptimizationService.name);
  private config: OptimizationConfig = {
    enabled: true,
    strategies: [
      OptimizationStrategy.CONCURRENCY_SCALING,
      OptimizationStrategy.BATCHING,
      OptimizationStrategy.THROTTLING,
    ],
    concurrencyLimits: {
      min: 1,
      max: 10,
      default: 3,
    },
    batchingConfig: {
      enabled: true,
      maxBatchSize: 10,
      batchWindow: 1000, // 1 second
      jobTypes: [],
    },
    throttlingConfig: {
      enabled: true,
      threshold: 100, // 100 jobs per second
      cooldown: 5000, // 5 seconds
    },
    timeoutConfig: {
      enabled: true,
      baseTimeout: 30000, // 30 seconds
      maxTimeout: 300000, // 5 minutes
    },
    priorityBoostConfig: {
      enabled: true,
      ageThreshold: 60000, // 1 minute
      boostAmount: 5,
    },
    loadSheddingConfig: {
      enabled: false,
      highWatermark: 10000,
      lowPriorityTypes: [],
    },
  };

  private currentConcurrency = 3;
  private isThrottling = false;
  private batchQueues: Map<string, Job[]> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  private processingTimes: Map<string, number[]> = new Map();
  private lastOptimizationRun = Date.now();

  constructor(
    private readonly queueService: QueueService,
    private readonly monitoringService: QueueMonitoringService,
  ) {}

  /**
   * Initialize optimization when module starts
   */
  onModuleInit() {
    if (this.config.enabled) {
      this.startOptimization();
    }
  }

  /**
   * Set optimization configuration
   */
  setConfig(config: Partial<OptimizationConfig>): void {
    const wasEnabled = this.config.enabled;
    
    this.config = {
      ...this.config,
      ...config,
      concurrencyLimits: {
        ...this.config.concurrencyLimits,
        ...config.concurrencyLimits,
      },
      batchingConfig: {
        ...this.config.batchingConfig,
        ...config.batchingConfig,
      },
      throttlingConfig: {
        ...this.config.throttlingConfig,
        ...config.throttlingConfig,
      },
      timeoutConfig: {
        ...this.config.timeoutConfig,
        ...config.timeoutConfig,
      },
      priorityBoostConfig: {
        ...this.config.priorityBoostConfig,
        ...config.priorityBoostConfig,
      },
      loadSheddingConfig: {
        ...this.config.loadSheddingConfig,
        ...config.loadSheddingConfig,
      },
    };
    
    // Start or stop optimization based on enabled flag
    if (!wasEnabled && this.config.enabled) {
      this.startOptimization();
    } else if (wasEnabled && !this.config.enabled) {
      this.stopOptimization();
    }
    
    this.logger.log(`Optimization configuration updated, enabled: ${this.config.enabled}`);
  }

  /**
   * Get current optimization configuration
   */
  getConfig(): OptimizationConfig {
    return { ...this.config };
  }

  /**
   * Start the optimization process
   */
  private startOptimization(): void {
    this.logger.log('Starting queue optimization');
    
    // Subscribe to job events
    this.queueService.onCompleted().subscribe(job => {
      this.trackJobCompletion(job);
    });

    // Set up periodic optimization
    setInterval(() => this.runOptimizations(), 30000); // Every 30 seconds
    
    // Set up monitoring subscription
    this.monitoringService.onMetricsUpdate().subscribe(metrics => {
      if (metrics) {
        this.adjustBasedOnMetrics(metrics);
      }
    });
  }

  /**
   * Stop the optimization process
   */
  private stopOptimization(): void {
    this.logger.log('Stopping queue optimization');
    // Interval subscriptions will be garbage collected
    
    // Clear any batch timers
    for (const timer of this.batchTimers.values()) {
      clearTimeout(timer);
    }
    this.batchTimers.clear();
    this.batchQueues.clear();
  }

  /**
   * Run all enabled optimization strategies
   */
  private runOptimizations(): void {
    if (!this.config.enabled) {
      return;
    }

    this.lastOptimizationRun = Date.now();
    
    // Run each enabled strategy
    for (const strategy of this.config.strategies) {
      try {
        switch (strategy) {
          case OptimizationStrategy.CONCURRENCY_SCALING:
            this.optimizeConcurrency();
            break;
          case OptimizationStrategy.ADAPTIVE_TIMEOUT:
            this.optimizeTimeouts();
            break;
          case OptimizationStrategy.PRIORITY_BOOSTING:
            this.boostOldJobs();
            break;
          case OptimizationStrategy.LOAD_SHEDDING:
            this.performLoadShedding();
            break;
          // Batching and throttling are handled in real-time, not in this periodic function
        }
      } catch (error) {
        this.logger.error(`Error running optimization strategy ${strategy}: ${error.message}`, error.stack);
      }
    }
  }

  /**
   * Track job completion for metrics
   */
  private trackJobCompletion(job: Job): void {
    // Track processing time
    if (job.lastAttemptedAt) {
      const processingTime = Date.now() - job.lastAttemptedAt.getTime();
      
      if (!this.processingTimes.has(job.name)) {
        this.processingTimes.set(job.name, []);
      }
      
      const times = this.processingTimes.get(job.name) || [];
      times.push(processingTime);
      
      // Keep only the last 100 processing times
      if (times.length > 100) {
        times.shift();
      }
    }
  }

  /**
   * Adjust optimization based on monitoring metrics
   */
  private adjustBasedOnMetrics(metrics: any): void {
    // Check if we need to throttle based on queue size or error rate
    if (metrics.queueSize > this.config.throttlingConfig.threshold * 2 || 
        metrics.errorRate > 20) {
      this.enableThrottling();
    } else if (this.isThrottling && 
               metrics.queueSize < this.config.throttlingConfig.threshold / 2 && 
               metrics.errorRate < 10) {
      this.disableThrottling();
    }
  }

  /**
   * Optimize concurrency based on queue size and processing times
   */
  private optimizeConcurrency(): void {
    const metrics = this.monitoringService.getCurrentMetrics();
    if (!metrics) {
      return;
    }

    const { queueSize, averageProcessingTime, errorRate } = metrics;
    
    // Calculate optimal concurrency based on metrics
    let optimalConcurrency = this.currentConcurrency;
    
    // Increase concurrency if queue is growing and error rate is low
    if (queueSize > 10 && errorRate < 10 && this.currentConcurrency < this.config.concurrencyLimits.max) {
      optimalConcurrency = Math.min(
        this.currentConcurrency + 1,
        this.config.concurrencyLimits.max
      );
    }
    
    // Decrease concurrency if error rate is high
    else if (errorRate > 15 && this.currentConcurrency > this.config.concurrencyLimits.min) {
      optimalConcurrency = Math.max(
        this.currentConcurrency - 1,
        this.config.concurrencyLimits.min
      );
    }
    
    // Adjust concurrency if needed
    if (optimalConcurrency !== this.currentConcurrency) {
      this.currentConcurrency = optimalConcurrency;
      this.queueService.setConcurrency(this.currentConcurrency);
      this.logger.log(`Adjusted concurrency to ${this.currentConcurrency} based on metrics`);
    }
  }

  /**
   * Enable throttling to reduce system load
   */
  private enableThrottling(): void {
    if (this.isThrottling || !this.config.throttlingConfig.enabled) {
      return;
    }
    
    this.isThrottling = true;
    this.queueService.setProcessingEnabled(false);
    this.logger.warn('Throttling enabled due to high load or error rate');
    
    // Automatically disable throttling after cooldown period
    setTimeout(() => {
      this.disableThrottling();
    }, this.config.throttlingConfig.cooldown);
  }

  /**
   * Disable throttling and resume normal processing
   */
  private disableThrottling(): void {
    if (!this.isThrottling) {
      return;
    }
    
    this.isThrottling = false;
    this.queueService.setProcessingEnabled(true);
    this.logger.log('Throttling disabled, resuming normal processing');
  }

  /**
   * Optimize job timeouts based on processing history
   */
  private optimizeTimeouts(): void {
    if (!this.config.timeoutConfig.enabled) {
      return;
    }
    
    // For each job type, calculate optimal timeout based on processing history
    for (const [jobType, times] of this.processingTimes.entries()) {
      if (times.length < 10) {
        continue; // Not enough data
      }
      
      // Calculate average and standard deviation
      const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
      const variance = times.reduce((sum, time) => sum + Math.pow(time - avg, 2), 0) / times.length;
      const stdDev = Math.sqrt(variance);
      
      // Set timeout to average + 3 standard deviations (99.7% of normal distribution)
      const optimalTimeout = Math.min(
        Math.max(avg + 3 * stdDev, this.config.timeoutConfig.baseTimeout),
        this.config.timeoutConfig.maxTimeout
      );
      
      // Update default timeout for this job type
      this.queueService.setDefaultJobOptions(jobType, { timeout: Math.ceil(optimalTimeout) });
      
      this.logger.debug(`Optimized timeout for ${jobType}: ${Math.ceil(optimalTimeout)}ms`);
    }
  }

  /**
   * Boost priority of old jobs to prevent starvation
   */
  private async boostOldJobs(): Promise<void> {
    if (!this.config.priorityBoostConfig.enabled) {
      return;
    }
    
    const now = Date.now();
    const ageThreshold = this.config.priorityBoostConfig.ageThreshold;
    const boostAmount = this.config.priorityBoostConfig.boostAmount;
    
    // Get old pending jobs
    const oldJobs = await this.queueService.getJobsByFilter({
      status: JobStatus.PENDING,
      createdBefore: new Date(now - ageThreshold),
      limit: 100,
    });
    
    if (oldJobs.length === 0) {
      return;
    }
    
    this.logger.log(`Boosting priority for ${oldJobs.length} old jobs`);
    
    // Boost priority for each old job
    for (const job of oldJobs) {
      job.priority += boostAmount;
      await this.queueService.updateJob(job);
    }
  }

  /**
   * Perform load shedding by removing low-priority jobs when queue is too large
   */
  private async performLoadShedding(): Promise<void> {
    if (!this.config.loadSheddingConfig.enabled) {
      return;
    }
    
    const metrics = this.monitoringService.getCurrentMetrics();
    if (!metrics || metrics.queueSize <= this.config.loadSheddingConfig.highWatermark) {
      return;
    }
    
    const lowPriorityTypes = this.config.loadSheddingConfig.lowPriorityTypes;
    if (lowPriorityTypes.length === 0) {
      return;
    }
    
    this.logger.warn(`Queue size (${metrics.queueSize}) exceeds high watermark, performing load shedding`);
    
    // Get low priority jobs
    for (const jobType of lowPriorityTypes) {
      const lowPriorityJobs = await this.queueService.getJobsByFilter({
        status: JobStatus.PENDING,
        name: jobType,
        limit: 50,
      });
      
      if (lowPriorityJobs.length > 0) {
        this.logger.warn(`Removing ${lowPriorityJobs.length} low priority jobs of type ${jobType}`);
        
        // Remove jobs
        for (const job of lowPriorityJobs) {
          await this.queueService.removeJob(job.id);
        }
      }
    }
  }

  /**
   * Process a job, applying optimization strategies as needed
   */
  async processJob(job: Job): Promise<boolean> {
    // Check if job should be batched
    if (this.shouldBatchJob(job)) {
      return this.addToBatch(job);
    }
    
    // Apply other optimizations and process normally
    return this.queueService.processJob(job);
  }

  /**
   * Determine if a job should be batched
   */
  private shouldBatchJob(job: Job): boolean {
    if (!this.config.batchingConfig.enabled) {
      return false;
    }
    
    // Check if job type is configured for batching
    return this.config.batchingConfig.jobTypes.includes(job.name);
  }

  /**
   * Add a job to a batch for processing
   */
  private addToBatch(job: Job): boolean {
    const jobType = job.name;
    
    // Create batch queue if it doesn't exist
    if (!this.batchQueues.has(jobType)) {
      this.batchQueues.set(jobType, []);
    }
    
    // Add job to batch
    const batch = this.batchQueues.get(jobType) || [];
    batch.push(job);
    
    this.logger.debug(`Added job ${job.id} to batch for ${jobType}, batch size: ${batch.length}`);
    
    // Process batch if it reaches max size
    if (batch.length >= this.config.batchingConfig.maxBatchSize) {
      this.processBatch(jobType);
      return true;
    }
    
    // Set timer to process batch if one isn't already set
    if (!this.batchTimers.has(jobType)) {
      const timer = setTimeout(() => {
        this.processBatch(jobType);
      }, this.config.batchingConfig.batchWindow);
      
      this.batchTimers.set(jobType, timer);
    }
    
    return true;
  }

  /**
   * Process a batch of jobs
   */
  private async processBatch(jobType: string): Promise<void> {
    // Clear timer if exists
    if (this.batchTimers.has(jobType)) {
      clearTimeout(this.batchTimers.get(jobType));
      this.batchTimers.delete(jobType);
    }
    
    // Get batch
    const batch = this.batchQueues.get(jobType) || [];
    if (batch.length === 0) {
      return;
    }
    
    this.logger.log(`Processing batch of ${batch.length} jobs for ${jobType}`);
    
    // Clear batch queue
    this.batchQueues.set(jobType, []);
    
    // Process each job in batch
    for (const job of batch) {
      try {
        await this.queueService.processJob(job);
      } catch (error) {
        this.logger.error(`Error processing batched job ${job.id}: ${error.message}`);
      }
    }
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats(): Record<string, any> {
    return {
      enabled: this.config.enabled,
      currentConcurrency: this.currentConcurrency,
      isThrottling: this.isThrottling,
      activeStrategies: this.config.strategies,
      batchQueueSizes: Array.from(this.batchQueues.entries()).map(([type, jobs]) => ({
        jobType: type,
        size: jobs.length,
      })),
      lastOptimizationRun: new Date(this.lastOptimizationRun),
      processingTimeStats: Array.from(this.processingTimes.entries()).map(([type, times]) => {
        if (times.length === 0) {
          return { jobType: type, count: 0 };
        }
        
        const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
        const min = Math.min(...times);
        const max = Math.max(...times);
        
        return {
          jobType: type,
          count: times.length,
          avgMs: Math.round(avg),
          minMs: min,
          maxMs: max,
        };
      }),
    };
  }
}