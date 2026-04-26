import { Injectable, Logger } from '@nestjs/common';
import { JobPriority } from '../enums/job-priority.enum';
import { JobOptions } from '../interfaces/queue.interfaces';
import {
  PRIORITY_SCORES,
  PRIORITY_THRESHOLDS,
  PRIORITY_JOB_CONFIG,
  JOB_AGE_THRESHOLDS,
} from '../queues.constants';

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
        premium: PRIORITY_SCORES.TIER_PREMIUM,
        pro: PRIORITY_SCORES.TIER_PRO,
        basic: PRIORITY_SCORES.TIER_BASIC,
        free: PRIORITY_SCORES.TIER_FREE,
      };
      score += tierScores[factors.userTier] || 0;
    }

    // Urgency weight (0-25 points)
    if (factors.urgency) {
      const urgencyScores = {
        critical: PRIORITY_SCORES.URGENCY_CRITICAL,
        high: PRIORITY_SCORES.URGENCY_HIGH,
        medium: PRIORITY_SCORES.URGENCY_MEDIUM,
        low: PRIORITY_SCORES.URGENCY_LOW,
      };
      score += urgencyScores[factors.urgency] || 0;
    }

    // Business impact weight (0-25 points)
    if (factors.businessImpact) {
      const impactScores = {
        revenue: PRIORITY_SCORES.IMPACT_REVENUE,
        customer: PRIORITY_SCORES.IMPACT_CUSTOMER,
        operational: PRIORITY_SCORES.IMPACT_OPERATIONAL,
        internal: PRIORITY_SCORES.IMPACT_INTERNAL,
      };
      score += impactScores[factors.businessImpact] || 0;
    }

    // Time sensitivity (0-20 points)
    if (factors.deadline) {
      const now = Date.now();
      const deadline = new Date(factors.deadline).getTime();
      const timeLeft = deadline - now;
      const hoursLeft = timeLeft / (1000 * 60 * 60);

      if (hoursLeft < 1) score += PRIORITY_SCORES.TIME_WITHIN_1H;
      else if (hoursLeft < 6) score += PRIORITY_SCORES.TIME_WITHIN_6H;
      else if (hoursLeft < 24) score += PRIORITY_SCORES.TIME_WITHIN_24H;
      else if (hoursLeft < 72) score += PRIORITY_SCORES.TIME_WITHIN_72H;
    }

    // Map score to priority level
    return this.scoreToPriority(score);
  }

  /**
   * Convert numeric score to JobPriority enum
   */
  private scoreToPriority(score: number): JobPriority {
    if (score >= PRIORITY_THRESHOLDS.CRITICAL_MIN) return JobPriority.CRITICAL;
    if (score >= PRIORITY_THRESHOLDS.HIGH_MIN) return JobPriority.HIGH;
    if (score >= PRIORITY_THRESHOLDS.NORMAL_MIN) return JobPriority.NORMAL;
    if (score >= PRIORITY_THRESHOLDS.LOW_MIN) return JobPriority.LOW;
    return JobPriority.BACKGROUND;
  }

  /**
   * Get recommended job options based on priority
   */
  getJobOptions(priority: JobPriority): Partial<JobOptions> {
    const optionsMap: Record<JobPriority, Partial<JobOptions>> = {
      [JobPriority.CRITICAL]: {
        priority: JobPriority.CRITICAL,
        attempts: PRIORITY_JOB_CONFIG.CRITICAL.attempts,
        timeout: PRIORITY_JOB_CONFIG.CRITICAL.timeoutMs,
        backoff: {
          type: PRIORITY_JOB_CONFIG.CRITICAL.backoffType,
          delay: PRIORITY_JOB_CONFIG.CRITICAL.backoffDelayMs,
        },
        removeOnComplete: PRIORITY_JOB_CONFIG.CRITICAL.removeOnComplete,
        removeOnFail: PRIORITY_JOB_CONFIG.CRITICAL.removeOnFail,
      },
      [JobPriority.HIGH]: {
        priority: JobPriority.HIGH,
        attempts: PRIORITY_JOB_CONFIG.HIGH.attempts,
        timeout: PRIORITY_JOB_CONFIG.HIGH.timeoutMs,
        backoff: {
          type: PRIORITY_JOB_CONFIG.HIGH.backoffType,
          delay: PRIORITY_JOB_CONFIG.HIGH.backoffDelayMs,
        },
        removeOnComplete: PRIORITY_JOB_CONFIG.HIGH.removeOnComplete,
        removeOnFail: PRIORITY_JOB_CONFIG.HIGH.removeOnFail,
      },
      [JobPriority.NORMAL]: {
        priority: JobPriority.NORMAL,
        attempts: PRIORITY_JOB_CONFIG.NORMAL.attempts,
        timeout: PRIORITY_JOB_CONFIG.NORMAL.timeoutMs,
        backoff: {
          type: PRIORITY_JOB_CONFIG.NORMAL.backoffType,
          delay: PRIORITY_JOB_CONFIG.NORMAL.backoffDelayMs,
        },
        removeOnComplete: PRIORITY_JOB_CONFIG.NORMAL.removeOnComplete,
        removeOnFail: PRIORITY_JOB_CONFIG.NORMAL.removeOnFail,
      },
      [JobPriority.LOW]: {
        priority: JobPriority.LOW,
        attempts: PRIORITY_JOB_CONFIG.LOW.attempts,
        timeout: PRIORITY_JOB_CONFIG.LOW.timeoutMs,
        backoff: {
          type: PRIORITY_JOB_CONFIG.LOW.backoffType,
          delay: PRIORITY_JOB_CONFIG.LOW.backoffDelayMs,
        },
        removeOnComplete: PRIORITY_JOB_CONFIG.LOW.removeOnComplete,
        removeOnFail: PRIORITY_JOB_CONFIG.LOW.removeOnFail,
      },
      [JobPriority.BACKGROUND]: {
        priority: JobPriority.BACKGROUND,
        attempts: PRIORITY_JOB_CONFIG.BACKGROUND.attempts,
        timeout: PRIORITY_JOB_CONFIG.BACKGROUND.timeoutMs,
        backoff: {
          type: PRIORITY_JOB_CONFIG.BACKGROUND.backoffType,
          delay: PRIORITY_JOB_CONFIG.BACKGROUND.backoffDelayMs,
        },
        removeOnComplete: PRIORITY_JOB_CONFIG.BACKGROUND.removeOnComplete,
        removeOnFail: PRIORITY_JOB_CONFIG.BACKGROUND.removeOnFail,
      },
    };

    return optionsMap[priority];
  }

  /**
   * Adjust priority dynamically based on job age
   */
  adjustPriorityByAge(currentPriority: JobPriority, createdAt: Date): JobPriority {
    const ageInHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);

    // Increase priority for jobs waiting too long
    if (ageInHours > JOB_AGE_THRESHOLDS.LONG_WAIT_HOURS && currentPriority > JobPriority.CRITICAL) {
      this.logger.log(
        `Increasing priority for job older than 24 hours: ${currentPriority} -> ${currentPriority - 1}`,
      );
      return (currentPriority - 1) as JobPriority;
    }

    if (ageInHours > JOB_AGE_THRESHOLDS.EXTENDED_WAIT_HOURS && currentPriority > JobPriority.HIGH) {
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
