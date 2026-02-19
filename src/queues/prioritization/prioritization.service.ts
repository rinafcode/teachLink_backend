import { Injectable, Logger } from '@nestjs/common';
import { JobPriority } from '../enums/job-priority.enum';
import { JobOptions } from '../interfaces/queue.interfaces';

/**
 * Job Prioritization Service
 * Determines job priority based on various factors
 */
@Injectable()
export class PrioritizationService {
  private readonly logger = new Logger(PrioritizationService.name);

  /**
   * Calculate job priority based on multiple factors
   */
  calculatePriority(factors: PriorityFactors): JobPriority {
    let score = 0;

    // User tier weight (0-30 points)
    if (factors.userTier) {
      const tierScores = {
        premium: 30,
        pro: 20,
        basic: 10,
        free: 0,
      };
      score += tierScores[factors.userTier] || 0;
    }

    // Urgency weight (0-25 points)
    if (factors.urgency) {
      const urgencyScores = {
        critical: 25,
        high: 20,
        medium: 10,
        low: 0,
      };
      score += urgencyScores[factors.urgency] || 0;
    }

    // Business impact weight (0-25 points)
    if (factors.businessImpact) {
      const impactScores = {
        revenue: 25,
        customer: 20,
        operational: 15,
        internal: 5,
      };
      score += impactScores[factors.businessImpact] || 0;
    }

    // Time sensitivity (0-20 points)
    if (factors.deadline) {
      const now = Date.now();
      const deadline = new Date(factors.deadline).getTime();
      const timeLeft = deadline - now;
      const hoursLeft = timeLeft / (1000 * 60 * 60);

      if (hoursLeft < 1) score += 20;
      else if (hoursLeft < 6) score += 15;
      else if (hoursLeft < 24) score += 10;
      else if (hoursLeft < 72) score += 5;
    }

    // Map score to priority level
    return this.scoreToPriority(score);
  }

  /**
   * Convert numeric score to JobPriority enum
   */
  private scoreToPriority(score: number): JobPriority {
    if (score >= 70) return JobPriority.CRITICAL;
    if (score >= 50) return JobPriority.HIGH;
    if (score >= 30) return JobPriority.NORMAL;
    if (score >= 15) return JobPriority.LOW;
    return JobPriority.BACKGROUND;
  }

  /**
   * Get recommended job options based on priority
   */
  getJobOptions(priority: JobPriority): Partial<JobOptions> {
    const optionsMap: Record<JobPriority, Partial<JobOptions>> = {
      [JobPriority.CRITICAL]: {
        priority: JobPriority.CRITICAL,
        attempts: 5,
        timeout: 60000,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: false,
        removeOnFail: false,
      },
      [JobPriority.HIGH]: {
        priority: JobPriority.HIGH,
        attempts: 4,
        timeout: 45000,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
      [JobPriority.NORMAL]: {
        priority: JobPriority.NORMAL,
        attempts: 3,
        timeout: 30000,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
      [JobPriority.LOW]: {
        priority: JobPriority.LOW,
        attempts: 2,
        timeout: 20000,
        backoff: {
          type: 'fixed',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: true,
      },
      [JobPriority.BACKGROUND]: {
        priority: JobPriority.BACKGROUND,
        attempts: 1,
        timeout: 15000,
        backoff: {
          type: 'fixed',
          delay: 10000,
        },
        removeOnComplete: true,
        removeOnFail: true,
      },
    };

    return optionsMap[priority];
  }

  /**
   * Adjust priority dynamically based on job age
   */
  adjustPriorityByAge(
    currentPriority: JobPriority,
    createdAt: Date,
  ): JobPriority {
    const ageInHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);

    // Increase priority for jobs waiting too long
    if (ageInHours > 24 && currentPriority > JobPriority.CRITICAL) {
      this.logger.log(
        `Increasing priority for job older than 24 hours: ${currentPriority} -> ${currentPriority - 1}`,
      );
      return (currentPriority - 1) as JobPriority;
    }

    if (ageInHours > 12 && currentPriority > JobPriority.HIGH) {
      this.logger.log(
        `Increasing priority for job older than 12 hours: ${currentPriority} -> ${currentPriority - 1}`,
      );
      return (currentPriority - 1) as JobPriority;
    }

    return currentPriority;
  }
}

export interface PriorityFactors {
  userTier?: 'premium' | 'pro' | 'basic' | 'free';
  urgency?: 'critical' | 'high' | 'medium' | 'low';
  businessImpact?: 'revenue' | 'customer' | 'operational' | 'internal';
  deadline?: Date | string;
}
