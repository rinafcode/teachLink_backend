import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModerationAnalytics } from '../entities/moderation-analytics.entity';
import { ModerationAction, ActionType } from '../entities/moderation-action.entity';
import { ModerationQueue, QueueStatus } from '../entities/moderation-queue.entity';
import { ContentReport, ReportStatus } from '../entities/content-report.entity';
import { SafetyScore } from '../entities/safety-score.entity';

export interface ModerationMetrics {
  totalReviews: number;
  averageReviewTime: number;
  accuracy: number;
  falsePositives: number;
  falseNegatives: number;
  truePositives: number;
  trueNegatives: number;
  categoryBreakdown: Record<string, number>;
  actionBreakdown: Record<string, number>;
}

export interface PerformanceReport {
  moderatorId: string;
  period: string;
  metrics: ModerationMetrics;
  trends: Record<string, number[]>;
  recommendations: string[];
}

@Injectable()
export class ModerationAnalyticsService {
  private readonly logger = new Logger(ModerationAnalyticsService.name);

  constructor(
    @InjectRepository(ModerationAnalytics)
    private moderationAnalyticsRepository: Repository<ModerationAnalytics>,
    @InjectRepository(ModerationAction)
    private moderationActionRepository: Repository<ModerationAction>,
    @InjectRepository(ModerationQueue)
    private moderationQueueRepository: Repository<ModerationQueue>,
    @InjectRepository(ContentReport)
    private contentReportRepository: Repository<ContentReport>,
    @InjectRepository(SafetyScore)
    private safetyScoreRepository: Repository<SafetyScore>,
  ) {}

  async recordReview(moderatorId: string, actionType: ActionType): Promise<void> {
    this.logger.log(`Recording review for moderator ${moderatorId}, action: ${actionType}`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let analytics = await this.moderationAnalyticsRepository.findOne({
      where: { moderatorId, date: today },
    });

    if (!analytics) {
      analytics = this.moderationAnalyticsRepository.create({
        moderatorId,
        date: today,
        totalReviews: 0,
        approvedContent: 0,
        rejectedContent: 0,
        escalatedContent: 0,
        averageReviewTime: 0,
        accuracy: 0,
      });
    }

    // Update counts
    analytics.totalReviews += 1;

    switch (actionType) {
      case ActionType.APPROVE:
        analytics.approvedContent += 1;
        break;
      case ActionType.REJECT:
      case ActionType.REMOVE_CONTENT:
      case ActionType.HIDE_CONTENT:
        analytics.rejectedContent += 1;
        break;
      case ActionType.ESCALATE:
        analytics.escalatedContent += 1;
        break;
    }

    // Update category breakdown
    const categoryBreakdown = analytics.categoryBreakdown || {};
    // This would be updated based on the content categories reviewed
    analytics.categoryBreakdown = categoryBreakdown;

    // Update action breakdown
    const actionBreakdown = analytics.actionBreakdown || {};
    actionBreakdown[actionType] = (actionBreakdown[actionType] || 0) + 1;
    analytics.actionBreakdown = actionBreakdown;

    await this.moderationAnalyticsRepository.save(analytics);
  }

  async getModeratorPerformance(
    moderatorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<PerformanceReport> {
    this.logger.log(`Getting performance report for moderator ${moderatorId}`);

    const analytics = await this.moderationAnalyticsRepository
      .createQueryBuilder('analytics')
      .where('analytics.moderatorId = :moderatorId', { moderatorId })
      .andWhere('analytics.date >= :startDate', { startDate })
      .andWhere('analytics.date <= :endDate', { endDate })
      .orderBy('analytics.date', 'ASC')
      .getMany();

    const metrics = this.calculateMetrics(analytics);
    const trends = this.calculateTrends(analytics);
    const recommendations = this.generateRecommendations(metrics);

    return {
      moderatorId,
      period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
      metrics,
      trends,
      recommendations,
    };
  }

  async getSystemWideMetrics(days = 30): Promise<ModerationMetrics> {
    this.logger.log(`Getting system-wide metrics for last ${days} days`);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [actions, queues, reports, safetyScores] = await Promise.all([
      this.moderationActionRepository
        .createQueryBuilder('action')
        .where('action.createdAt >= :startDate', { startDate })
        .andWhere('action.createdAt <= :endDate', { endDate })
        .getMany(),
      this.moderationQueueRepository
        .createQueryBuilder('queue')
        .where('queue.createdAt >= :startDate', { startDate })
        .andWhere('queue.createdAt <= :endDate', { endDate })
        .getMany(),
      this.contentReportRepository
        .createQueryBuilder('report')
        .where('report.createdAt >= :startDate', { startDate })
        .andWhere('report.createdAt <= :endDate', { endDate })
        .getMany(),
      this.safetyScoreRepository
        .createQueryBuilder('score')
        .where('score.createdAt >= :startDate', { startDate })
        .andWhere('score.createdAt <= :endDate', { endDate })
        .getMany(),
    ]);

    return this.calculateSystemMetrics(actions, queues, reports, safetyScores);
  }

  async getAccuracyMetrics(days = 30): Promise<{
    overallAccuracy: number;
    falsePositiveRate: number;
    falseNegativeRate: number;
    precision: number;
    recall: number;
    f1Score: number;
  }> {
    this.logger.log(`Calculating accuracy metrics for last ${days} days`);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get actions and their outcomes
    const actions = await this.moderationActionRepository
      .createQueryBuilder('action')
      .where('action.createdAt >= :startDate', { startDate })
      .andWhere('action.createdAt <= :endDate', { endDate })
      .getMany();

    // Calculate accuracy metrics
    let truePositives = 0;
    let trueNegatives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;

    for (const action of actions) {
      // This is a simplified calculation - in a real system, you'd compare
      // moderator decisions with ground truth or appeal outcomes
      const isCorrect = this.estimateDecisionAccuracy(action);
      
      if (action.actionType === ActionType.APPROVE) {
        if (isCorrect) trueNegatives++;
        else falseNegatives++;
      } else {
        if (isCorrect) truePositives++;
        else falsePositives++;
      }
    }

    const total = truePositives + trueNegatives + falsePositives + falseNegatives;
    const overallAccuracy = total > 0 ? (truePositives + trueNegatives) / total : 0;
    const falsePositiveRate = (trueNegatives + falsePositives) > 0 ? falsePositives / (trueNegatives + falsePositives) : 0;
    const falseNegativeRate = (truePositives + falseNegatives) > 0 ? falseNegatives / (truePositives + falseNegatives) : 0;
    const precision = (truePositives + falsePositives) > 0 ? truePositives / (truePositives + falsePositives) : 0;
    const recall = (truePositives + falseNegatives) > 0 ? truePositives / (truePositives + falseNegatives) : 0;
    const f1Score = (precision + recall) > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

    return {
      overallAccuracy,
      falsePositiveRate,
      falseNegativeRate,
      precision,
      recall,
      f1Score,
    };
  }

  async getQueueMetrics(): Promise<{
    pendingCount: number;
    averageWaitTime: number;
    priorityDistribution: Record<string, number>;
    contentTypeDistribution: Record<string, number>;
  }> {
    const pendingQueues = await this.moderationQueueRepository
      .createQueryBuilder('queue')
      .where('queue.status = :status', { status: QueueStatus.PENDING })
      .getMany();

    const priorityDistribution: Record<string, number> = {};
    const contentTypeDistribution: Record<string, number> = {};

    let totalWaitTime = 0;
    let count = 0;

    for (const queue of pendingQueues) {
      // Calculate wait time
      const waitTime = Date.now() - queue.createdAt.getTime();
      totalWaitTime += waitTime;
      count++;

      // Count priorities
      priorityDistribution[queue.priority] = (priorityDistribution[queue.priority] || 0) + 1;
      contentTypeDistribution[queue.contentType] = (contentTypeDistribution[queue.contentType] || 0) + 1;
    }

    return {
      pendingCount: pendingQueues.length,
      averageWaitTime: count > 0 ? totalWaitTime / count : 0,
      priorityDistribution,
      contentTypeDistribution,
    };
  }

  async getSafetyScoreTrends(days = 30): Promise<{
    averageScore: number;
    scoreDistribution: Record<string, number>;
    flaggedContentPercentage: number;
    categoryTrends: Record<string, number[]>;
  }> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const safetyScores = await this.safetyScoreRepository
      .createQueryBuilder('score')
      .where('score.createdAt >= :startDate', { startDate })
      .andWhere('score.createdAt <= :endDate', { endDate })
      .orderBy('score.createdAt', 'ASC')
      .getMany();

    const scores = safetyScores.map(score => score.overallScore);
    const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    // Calculate score distribution
    const scoreDistribution: Record<string, number> = {
      '0.0-0.2': 0,
      '0.2-0.4': 0,
      '0.4-0.6': 0,
      '0.6-0.8': 0,
      '0.8-1.0': 0,
    };

    for (const score of scores) {
      if (score < 0.2) scoreDistribution['0.0-0.2']++;
      else if (score < 0.4) scoreDistribution['0.2-0.4']++;
      else if (score < 0.6) scoreDistribution['0.4-0.6']++;
      else if (score < 0.8) scoreDistribution['0.6-0.8']++;
      else scoreDistribution['0.8-1.0']++;
    }

    // Calculate flagged content percentage
    const flaggedContent = safetyScores.filter(score => score.requiresManualReview);
    const flaggedContentPercentage = safetyScores.length > 0 ? (flaggedContent.length / safetyScores.length) * 100 : 0;

    // Calculate category trends (simplified)
    const categoryTrends: Record<string, number[]> = {};
    // This would be implemented to show trends over time for each category

    return {
      averageScore,
      scoreDistribution,
      flaggedContentPercentage,
      categoryTrends,
    };
  }

  private calculateMetrics(analytics: ModerationAnalytics[]): ModerationMetrics {
    const totalReviews = analytics.reduce((sum, a) => sum + a.totalReviews, 0);
    const totalApproved = analytics.reduce((sum, a) => sum + a.approvedContent, 0);
    const totalRejected = analytics.reduce((sum, a) => sum + a.rejectedContent, 0);
    const totalEscalated = analytics.reduce((sum, a) => sum + a.escalatedContent, 0);

    const averageReviewTime = analytics.length > 0 
      ? analytics.reduce((sum, a) => sum + a.averageReviewTime, 0) / analytics.length 
      : 0;

    const accuracy = totalReviews > 0 ? (totalApproved + totalRejected) / totalReviews : 0;

    // Simplified calculations - in a real system, you'd have more sophisticated accuracy tracking
    const falsePositives = Math.round(totalRejected * 0.1); // Estimate 10% false positives
    const falseNegatives = Math.round(totalApproved * 0.05); // Estimate 5% false negatives
    const truePositives = totalRejected - falsePositives;
    const trueNegatives = totalApproved - falseNegatives;

    // Aggregate category and action breakdowns
    const categoryBreakdown: Record<string, number> = {};
    const actionBreakdown: Record<string, number> = {};

    for (const analytic of analytics) {
      if (analytic.categoryBreakdown) {
        for (const [category, count] of Object.entries(analytic.categoryBreakdown)) {
          categoryBreakdown[category] = (categoryBreakdown[category] || 0) + count;
        }
      }
      if (analytic.actionBreakdown) {
        for (const [action, count] of Object.entries(analytic.actionBreakdown)) {
          actionBreakdown[action] = (actionBreakdown[action] || 0) + count;
        }
      }
    }

    return {
      totalReviews,
      averageReviewTime,
      accuracy,
      falsePositives,
      falseNegatives,
      truePositives,
      trueNegatives,
      categoryBreakdown,
      actionBreakdown,
    };
  }

  private calculateTrends(analytics: ModerationAnalytics[]): Record<string, number[]> {
    const trends: Record<string, number[]> = {
      totalReviews: [],
      accuracy: [],
      averageReviewTime: [],
    };

    for (const analytic of analytics) {
      trends.totalReviews.push(analytic.totalReviews);
      trends.accuracy.push(analytic.accuracy);
      trends.averageReviewTime.push(analytic.averageReviewTime);
    }

    return trends;
  }

  private generateRecommendations(metrics: ModerationMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.accuracy < 0.8) {
      recommendations.push('Consider additional training for moderators to improve accuracy');
    }

    if (metrics.averageReviewTime > 15) {
      recommendations.push('Review process may be taking too long - consider streamlining workflows');
    }

    if (metrics.falsePositives > 10) {
      recommendations.push('Reduce false positives by refining detection rules.');
    }
    if (metrics.falseNegatives > 5) {
      recommendations.push('Reduce false negatives by improving training data.');
    }

    return recommendations;
  }

  private calculateSystemMetrics(
    actions: ModerationAction[],
    queues: ModerationQueue[],
    reports: ContentReport[],
    safetyScores: SafetyScore[],
  ): ModerationMetrics {
    const totalReviews = actions.length;
    const approvedContent = actions.filter(a => a.actionType === ActionType.APPROVE).length;
    const rejectedContent = actions.filter(a => 
      [ActionType.REJECT, ActionType.REMOVE_CONTENT, ActionType.HIDE_CONTENT].includes(a.actionType)
    ).length;

    const categoryBreakdown: Record<string, number> = {};
    const actionBreakdown: Record<string, number> = {};

    for (const action of actions) {
      actionBreakdown[action.actionType] = (actionBreakdown[action.actionType] || 0) + 1;
    }

    return {
      totalReviews,
      averageReviewTime: 10, // Placeholder
      accuracy: totalReviews > 0 ? (approvedContent + rejectedContent) / totalReviews : 0,
      falsePositives: Math.round(rejectedContent * 0.1),
      falseNegatives: Math.round(approvedContent * 0.05),
      truePositives: rejectedContent - Math.round(rejectedContent * 0.1),
      trueNegatives: approvedContent - Math.round(approvedContent * 0.05),
      categoryBreakdown,
      actionBreakdown,
    };
  }

  private estimateDecisionAccuracy(action: ModerationAction): boolean {
    // This is a simplified estimation - in a real system, you'd compare with:
    // - Appeal outcomes
    // - Subsequent content from the same user
    // - Community feedback
    // - Expert review
    
    // For now, we'll use a simple heuristic based on action type and severity
    if (action.actionType === ActionType.APPROVE) {
      return Math.random() > 0.05; // 95% accuracy for approvals
    } else {
      return Math.random() > 0.1; // 90% accuracy for rejections
    }
  }
} 