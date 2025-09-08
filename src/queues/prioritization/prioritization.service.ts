import { Injectable, Logger } from '@nestjs/common';
import { Job, JobStatus } from '../interfaces/job.interface';
import { QueueService } from '../queue.service';

/**
 * Priority strategies for job ordering
 */
export enum PriorityStrategy {
  FIFO = 'fifo',                 // First In, First Out
  LIFO = 'lifo',                 // Last In, First Out
  PRIORITY = 'priority',         // Based on priority field
  DEADLINE = 'deadline',         // Based on deadline
  WEIGHTED = 'weighted',         // Weighted combination of factors
  DYNAMIC = 'dynamic',           // Dynamically adjusted
  FAIR_SHARE = 'fair_share',     // Fair distribution among job types
}

/**
 * Configuration for priority calculation
 */
export interface PriorityConfig {
  strategy: PriorityStrategy;
  weights?: {
    priority?: number;           // Weight for job priority
    age?: number;                // Weight for job age
    attempts?: number;           // Weight for previous attempts
    deadline?: number;           // Weight for deadline proximity
    custom?: number;             // Weight for custom score
  };
  fairShareConfig?: {
    jobTypes: string[];          // Job types to balance
    targetRatios: number[];      // Target processing ratios
  };
  dynamicConfig?: {
    feedbackInterval: number;    // Interval for adjusting weights
    maxAdjustment: number;       // Maximum adjustment per interval
  };
}

/**
 * Service for job prioritization and ordering
 */
@Injectable()
export class PrioritizationService {
  private readonly logger = new Logger(PrioritizationService.name);
  private config: PriorityConfig = {
    strategy: PriorityStrategy.PRIORITY,
    weights: {
      priority: 1.0,
      age: 0.5,
      attempts: 0.2,
      deadline: 0.8,
      custom: 0.0,
    },
  };
  
  // For fair share strategy
  private jobTypeCounts: Map<string, number> = new Map();
  
  // For dynamic strategy
  private lastAdjustment: Date = new Date();
  private processingTimes: Map<string, number[]> = new Map();
  
  constructor(private readonly queueService: QueueService) {
    // Subscribe to job completion events to gather metrics
    this.queueService.onCompleted().subscribe(job => {
      this.trackJobCompletion(job);
    });
  }
  
  /**
   * Set the prioritization configuration
   */
  setConfig(config: PriorityConfig): void {
    this.config = {
      ...this.config,
      ...config,
      weights: {
        ...this.config.weights,
        ...config.weights,
      },
    };
    
    this.logger.log(`Prioritization strategy set to ${config.strategy}`);
  }
  
  /**
   * Get the current prioritization configuration
   */
  getConfig(): PriorityConfig {
    return { ...this.config };
  }
  
  /**
   * Calculate priority score for a job
   */
  calculatePriorityScore(job: Job): number {
    switch (this.config.strategy) {
      case PriorityStrategy.FIFO:
        return this.calculateFifoScore(job);
      case PriorityStrategy.LIFO:
        return this.calculateLifoScore(job);
      case PriorityStrategy.PRIORITY:
        return job.priority;
      case PriorityStrategy.DEADLINE:
        return this.calculateDeadlineScore(job);
      case PriorityStrategy.WEIGHTED:
        return this.calculateWeightedScore(job);
      case PriorityStrategy.DYNAMIC:
        return this.calculateDynamicScore(job);
      case PriorityStrategy.FAIR_SHARE:
        return this.calculateFairShareScore(job);
      default:
        return job.priority;
    }
  }
  
  /**
   * Get the next job to process based on the current strategy
   */
  async getNextJob(): Promise<Job | null> {
    // Get all pending jobs
    const pendingJobs = await this.queueService.getJobs(JobStatus.PENDING, 100, 0);
    
    if (pendingJobs.length === 0) {
      return null;
    }
    
    // Calculate scores for all jobs
    const scoredJobs = pendingJobs.map(job => ({
      job,
      score: this.calculatePriorityScore(job),
    }));
    
    // Sort by score (higher score = higher priority)
    scoredJobs.sort((a, b) => b.score - a.score);
    
    // If using fair share, we might override the top job
    if (this.config.strategy === PriorityStrategy.FAIR_SHARE && this.config.fairShareConfig) {
      return this.applyFairSharePolicy(scoredJobs);
    }
    
    return scoredJobs[0]?.job || null;
  }
  
  /**
   * Update job priority
   */
  async updateJobPriority(jobId: string, priority: number): Promise<Job | null> {
    const job = await this.queueService.getJob(jobId);
    
    if (!job) {
      return null;
    }
    
    job.priority = priority;
    return job;
  }
  
  /**
   * Calculate score for FIFO strategy (older jobs have higher priority)
   */
  private calculateFifoScore(job: Job): number {
    return job.createdAt.getTime();
  }
  
  /**
   * Calculate score for LIFO strategy (newer jobs have higher priority)
   */
  private calculateLifoScore(job: Job): number {
    return -job.createdAt.getTime();
  }
  
  /**
   * Calculate score based on deadline proximity
   */
  private calculateDeadlineScore(job: Job): number {
    if (!job.scheduledFor) {
      return 0;
    }
    
    const now = new Date();
    const deadline = job.scheduledFor;
    const timeRemaining = deadline.getTime() - now.getTime();
    
    // Higher score for jobs closer to deadline
    return timeRemaining > 0 ? 1000000 / timeRemaining : 1000000;
  }
  
  /**
   * Calculate weighted score based on multiple factors
   */
  private calculateWeightedScore(job: Job): number {
    const weights = this.config.weights || {};
    const now = new Date();
    
    // Base priority
    let score = (job.priority || 0) * (weights.priority || 1.0);
    
    // Age factor (older jobs get higher priority)
    const ageMs = now.getTime() - job.createdAt.getTime();
    const ageMinutes = ageMs / 60000;
    score += ageMinutes * (weights.age || 0.5);
    
    // Previous attempts factor
    score += job.attempts * (weights.attempts || 0.2);
    
    // Deadline factor
    if (job.scheduledFor && weights.deadline) {
      const timeToDeadlineMs = job.scheduledFor.getTime() - now.getTime();
      const timeToDeadlineMinutes = Math.max(0, timeToDeadlineMs / 60000);
      
      // Higher score as deadline approaches
      if (timeToDeadlineMinutes < 10) {
        score += (10 - timeToDeadlineMinutes) * (weights.deadline || 0.8) * 10;
      }
    }
    
    return score;
  }
  
  /**
   * Calculate dynamic score that adjusts based on processing history
   */
  private calculateDynamicScore(job: Job): number {
    // Start with weighted score
    let score = this.calculateWeightedScore(job);
    
    // Apply dynamic adjustments based on processing history
    const jobTimes = this.processingTimes.get(job.name) || [];
    
    if (jobTimes.length > 0) {
      // Calculate average processing time for this job type
      const avgTime = jobTimes.reduce((sum, time) => sum + time, 0) / jobTimes.length;
      
      // Adjust score based on processing time (faster jobs get slight priority boost)
      const processingFactor = Math.max(0.5, Math.min(1.5, 1000 / avgTime));
      score *= processingFactor;
    }
    
    return score;
  }
  
  /**
   * Calculate fair share score to balance processing across job types
   */
  private calculateFairShareScore(job: Job): number {
    // Base score from weighted calculation
    const baseScore = this.calculateWeightedScore(job);
    
    // Apply fair share adjustment
    const fairShareConfig = this.config.fairShareConfig;
    if (!fairShareConfig) {
      return baseScore;
    }
    
    const jobTypeIndex = fairShareConfig.jobTypes.indexOf(job.name);
    if (jobTypeIndex === -1) {
      return baseScore;
    }
    
    // Get current count for this job type
    const processedCount = this.jobTypeCounts.get(job.name) || 0;
    
    // Calculate target ratio for this job type
    const targetRatio = fairShareConfig.targetRatios[jobTypeIndex] || 1;
    
    // Calculate total processed jobs
    let totalProcessed = 0;
    for (const count of this.jobTypeCounts.values()) {
      totalProcessed += count;
    }
    
    // Calculate current ratio
    const currentRatio = totalProcessed > 0 ? processedCount / totalProcessed : 0;
    
    // Adjust score based on difference from target ratio
    const ratioAdjustment = targetRatio - currentRatio;
    return baseScore * (1 + ratioAdjustment);
  }
  
  /**
   * Apply fair share policy to ensure balanced processing
   */
  private applyFairSharePolicy(scoredJobs: { job: Job; score: number }[]): Job | null {
    const fairShareConfig = this.config.fairShareConfig;
    if (!fairShareConfig || scoredJobs.length === 0) {
      return scoredJobs[0]?.job || null;
    }
    
    // Calculate total processed jobs
    let totalProcessed = 0;
    for (const count of this.jobTypeCounts.values()) {
      totalProcessed += count;
    }
    
    // If we haven't processed enough jobs yet, use regular scoring
    if (totalProcessed < 100) {
      return scoredJobs[0].job;
    }
    
    // Find the job type that's most under its target ratio
    let mostUnderservedType: string | null = null;
    let largestRatioDeficit = -Infinity;
    
    for (let i = 0; i < fairShareConfig.jobTypes.length; i++) {
      const jobType = fairShareConfig.jobTypes[i];
      const targetRatio = fairShareConfig.targetRatios[i] || 1;
      const processedCount = this.jobTypeCounts.get(jobType) || 0;
      const currentRatio = totalProcessed > 0 ? processedCount / totalProcessed : 0;
      const ratioDeficit = targetRatio - currentRatio;
      
      if (ratioDeficit > largestRatioDeficit) {
        largestRatioDeficit = ratioDeficit;
        mostUnderservedType = jobType;
      }
    }
    
    // If we found an underserved type, look for a job of that type
    if (mostUnderservedType && largestRatioDeficit > 0.1) {
      const jobOfType = scoredJobs.find(item => item.job.name === mostUnderservedType);
      if (jobOfType) {
        return jobOfType.job;
      }
    }
    
    // Fall back to highest scored job
    return scoredJobs[0].job;
  }
  
  /**
   * Track job completion for metrics
   */
  private trackJobCompletion(job: Job): void {
    // Update job type counts for fair share
    const currentCount = this.jobTypeCounts.get(job.name) || 0;
    this.jobTypeCounts.set(job.name, currentCount + 1);
    
    // Update processing times if we have timing data
    if (job.lastAttemptedAt) {
      const processingTime = new Date().getTime() - job.lastAttemptedAt.getTime();
      
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
    
    // Adjust weights dynamically if configured
    this.adjustDynamicWeights();
  }
  
  /**
   * Adjust weights dynamically based on processing history
   */
  private adjustDynamicWeights(): void {
    if (this.config.strategy !== PriorityStrategy.DYNAMIC || !this.config.dynamicConfig) {
      return;
    }
    
    const now = new Date();
    const timeSinceLastAdjustment = now.getTime() - this.lastAdjustment.getTime();
    
    // Only adjust at the configured interval
    if (timeSinceLastAdjustment < this.config.dynamicConfig.feedbackInterval) {
      return;
    }
    
    this.lastAdjustment = now;
    
    // Analyze processing times and error rates to adjust weights
    // This is a simplified implementation - in a real system, you would
    // use more sophisticated algorithms to optimize weights
    
    // For now, we'll just slightly increase the weight of factors that
    // seem to correlate with successful job processing
    
    const weights = this.config.weights || {};
    const maxAdjustment = this.config.dynamicConfig.maxAdjustment || 0.1;
    
    // Example adjustment: if jobs with higher priority are completing faster,
    // increase the priority weight
    weights.priority = Math.min(2.0, (weights.priority || 1.0) + maxAdjustment * 0.5);
    
    // Example adjustment: if older jobs are failing more, decrease the age weight
    weights.age = Math.max(0.1, (weights.age || 0.5) - maxAdjustment * 0.3);
    
    this.logger.debug('Dynamically adjusted priority weights', weights);
  }
}