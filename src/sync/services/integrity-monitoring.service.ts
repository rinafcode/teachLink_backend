import { Injectable, Logger } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  type IntegrityCheck,
  CheckStatus,
} from '../entities/integrity-check.entity';
import type { ConflictLog } from '../entities/conflict-log.entity';
import { type SyncEvent, SyncStatus } from '../entities/sync-event.entity';
import type { DataConsistencyService } from './data-consistency.service';
import { MoreThanOrEqual, LessThanOrEqual, Between } from 'typeorm';
import { ConflictStatus } from '../entities/conflict-log.entity';

export interface IntegrityAlert {
  id: string;
  type: 'consistency' | 'conflict' | 'replication_lag' | 'sync_failure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  entityType: string;
  entityId?: string;
  message: string;
  details: Record<string, any>;
  timestamp: Date;
}

@Injectable()
export class IntegrityMonitoringService {
  private readonly logger = new Logger(IntegrityMonitoringService.name);
  private readonly alertThresholds = {
    consistencyFailureRate: 0.05, // 5%
    conflictRate: 0.1, // 10%
    replicationLag: 300, // 5 minutes
    syncFailureRate: 0.02, // 2%
  };
  private readonly alertCallbacks = new Map<string, Function>();

  constructor(
    private readonly integrityCheckRepository: Repository<IntegrityCheck>,
    private readonly conflictLogRepository: Repository<ConflictLog>,
    private readonly syncEventRepository: Repository<SyncEvent>,
    private readonly dataConsistencyService: DataConsistencyService,
  ) {}

  async registerAlertCallback(type: string, callback: Function): Promise<void> {
    this.alertCallbacks.set(type, callback);
    this.logger.log(`Registered alert callback for type: ${type}`);
  }

  async triggerAlert(alert: IntegrityAlert): Promise<void> {
    this.logger.warn(
      `Integrity alert triggered: ${alert.type} - ${alert.message}`,
    );

    // Call registered callbacks
    const callback = this.alertCallbacks.get(alert.type);
    if (callback) {
      try {
        await callback(alert);
      } catch (error) {
        this.logger.error(
          `Alert callback failed for ${alert.type}: ${error.message}`,
        );
      }
    }

    // Store alert for historical tracking
    await this.storeAlert(alert);
  }

  async getIntegrityMetrics(
    entityType?: string,
    timeRange?: { start: Date; end: Date },
  ): Promise<{
    consistencyScore: number;
    conflictRate: number;
    syncSuccessRate: number;
    replicationHealth: number;
    alerts: IntegrityAlert[];
  }> {
    const whereCondition: any = {};
    if (entityType) whereCondition.entityType = entityType;
    if (timeRange) {
      whereCondition.createdAt = Between(timeRange.start, timeRange.end);
    }

    // Calculate consistency score
    const consistencyScore =
      await this.calculateConsistencyScore(whereCondition);

    // Calculate conflict rate
    const conflictRate = await this.calculateConflictRate(whereCondition);

    // Calculate sync success rate
    const syncSuccessRate = await this.calculateSyncSuccessRate(whereCondition);

    // Calculate replication health
    const replicationHealth =
      await this.calculateReplicationHealth(whereCondition);

    // Get recent alerts
    const alerts = await this.getRecentAlerts(entityType, 10);

    return {
      consistencyScore,
      conflictRate,
      syncSuccessRate,
      replicationHealth,
      alerts,
    };
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async monitorDataIntegrity(): Promise<void> {
    await this.checkConsistencyHealth();
    await this.checkConflictRates();
    await this.checkSyncHealth();
    await this.checkReplicationLag();
  }

  @Cron(CronExpression.EVERY_HOUR)
  async generateIntegrityReport(): Promise<void> {
    const entityTypes = await this.getMonitoredEntityTypes();

    for (const entityType of entityTypes) {
      const metrics = await this.getIntegrityMetrics(entityType, {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        end: new Date(),
      });

      this.logger.log(
        `Integrity report for ${entityType}: Consistency: ${metrics.consistencyScore.toFixed(2)}, Conflicts: ${metrics.conflictRate.toFixed(3)}, Sync Success: ${metrics.syncSuccessRate.toFixed(3)}`,
      );

      // Trigger alerts if thresholds are exceeded
      if (metrics.consistencyScore < 0.95) {
        await this.triggerAlert({
          id: `consistency-${entityType}-${Date.now()}`,
          type: 'consistency',
          severity: metrics.consistencyScore < 0.9 ? 'critical' : 'high',
          entityType,
          message: `Low consistency score: ${metrics.consistencyScore.toFixed(2)}`,
          details: { score: metrics.consistencyScore },
          timestamp: new Date(),
        });
      }

      if (metrics.conflictRate > this.alertThresholds.conflictRate) {
        await this.triggerAlert({
          id: `conflict-rate-${entityType}-${Date.now()}`,
          type: 'conflict',
          severity: metrics.conflictRate > 0.2 ? 'critical' : 'high',
          entityType,
          message: `High conflict rate: ${(metrics.conflictRate * 100).toFixed(1)}%`,
          details: { rate: metrics.conflictRate },
          timestamp: new Date(),
        });
      }
    }
  }

  async performHealthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'critical';
    issues: string[];
    recommendations: string[];
  }> {
    const issues = [];
    const recommendations = [];

    // Check recent consistency failures
    const recentFailures = await this.integrityCheckRepository.count({
      where: {
        status: CheckStatus.FAILED,
        createdAt: MoreThanOrEqual(new Date(Date.now() - 60 * 60 * 1000)), // Last hour
      },
    });

    if (recentFailures > 5) {
      issues.push(
        `${recentFailures} consistency check failures in the last hour`,
      );
      recommendations.push(
        'Review data synchronization processes and check for system issues',
      );
    }

    // Check unresolved conflicts
    const unresolvedConflicts = await this.conflictLogRepository.count({
      where: { status: ConflictStatus.DETECTED },
    });

    if (unresolvedConflicts > 10) {
      issues.push(`${unresolvedConflicts} unresolved conflicts`);
      recommendations.push(
        'Review conflict resolution strategies and resolve pending conflicts',
      );
    }

    // Check failed sync events
    const failedSyncs = await this.syncEventRepository.count({
      where: {
        status: SyncStatus.FAILED,
        createdAt: MoreThanOrEqual(new Date(Date.now() - 60 * 60 * 1000)),
      },
    });

    if (failedSyncs > 20) {
      issues.push(`${failedSyncs} failed sync events in the last hour`);
      recommendations.push(
        'Check data source connectivity and sync service health',
      );
    }

    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    if (issues.length > 0) {
      status = issues.length > 3 ? 'critical' : 'degraded';
    }

    return { status, issues, recommendations };
  }

  private async checkConsistencyHealth(): Promise<void> {
    const recentChecks = await this.integrityCheckRepository.find({
      where: {
        createdAt: MoreThanOrEqual(new Date(Date.now() - 60 * 60 * 1000)), // Last hour
      },
    });

    if (recentChecks.length === 0) return;

    const failedChecks = recentChecks.filter(
      (check) => check.status === CheckStatus.FAILED,
    );
    const failureRate = failedChecks.length / recentChecks.length;

    if (failureRate > this.alertThresholds.consistencyFailureRate) {
      await this.triggerAlert({
        id: `consistency-health-${Date.now()}`,
        type: 'consistency',
        severity: failureRate > 0.1 ? 'critical' : 'high',
        entityType: 'system',
        message: `High consistency check failure rate: ${(failureRate * 100).toFixed(1)}%`,
        details: {
          failureRate,
          totalChecks: recentChecks.length,
          failedChecks: failedChecks.length,
        },
        timestamp: new Date(),
      });
    }
  }

  private async checkConflictRates(): Promise<void> {
    const recentConflicts = await this.conflictLogRepository.count({
      where: {
        createdAt: MoreThanOrEqual(new Date(Date.now() - 60 * 60 * 1000)),
        status: ConflictStatus.DETECTED,
      },
    });

    const recentSyncs = await this.syncEventRepository.count({
      where: {
        createdAt: MoreThanOrEqual(new Date(Date.now() - 60 * 60 * 1000)),
      },
    });

    if (recentSyncs === 0) return;

    const conflictRate = recentConflicts / recentSyncs;

    if (conflictRate > this.alertThresholds.conflictRate) {
      await this.triggerAlert({
        id: `conflict-rate-${Date.now()}`,
        type: 'conflict',
        severity: conflictRate > 0.2 ? 'critical' : 'medium',
        entityType: 'system',
        message: `High conflict rate detected: ${(conflictRate * 100).toFixed(1)}%`,
        details: {
          conflictRate,
          conflicts: recentConflicts,
          syncs: recentSyncs,
        },
        timestamp: new Date(),
      });
    }
  }

  private async checkSyncHealth(): Promise<void> {
    const recentSyncs = await this.syncEventRepository.find({
      where: {
        createdAt: MoreThanOrEqual(new Date(Date.now() - 60 * 60 * 1000)),
      },
    });

    if (recentSyncs.length === 0) return;

    const failedSyncs = recentSyncs.filter(
      (sync) => sync.status === SyncStatus.FAILED,
    );
    const failureRate = failedSyncs.length / recentSyncs.length;

    if (failureRate > this.alertThresholds.syncFailureRate) {
      await this.triggerAlert({
        id: `sync-health-${Date.now()}`,
        type: 'sync_failure',
        severity: failureRate > 0.05 ? 'critical' : 'high',
        entityType: 'system',
        message: `High sync failure rate: ${(failureRate * 100).toFixed(1)}%`,
        details: {
          failureRate,
          totalSyncs: recentSyncs.length,
          failedSyncs: failedSyncs.length,
        },
        timestamp: new Date(),
      });
    }
  }

  private async checkReplicationLag(): Promise<void> {
    // This would check replication lag from ReplicationService
    // For now, we'll simulate the check
    this.logger.debug('Checking replication lag...');
  }

  private async calculateConsistencyScore(
    whereCondition: any,
  ): Promise<number> {
    const totalChecks = await this.integrityCheckRepository.count({
      where: whereCondition,
    });
    if (totalChecks === 0) return 1.0;

    const passedChecks = await this.integrityCheckRepository.count({
      where: { ...whereCondition, status: CheckStatus.PASSED },
    });

    return passedChecks / totalChecks;
  }

  private async calculateConflictRate(whereCondition: any): Promise<number> {
    const totalSyncs = await this.syncEventRepository.count({
      where: whereCondition,
    });
    if (totalSyncs === 0) return 0;

    const conflicts = await this.conflictLogRepository.count({
      where: whereCondition,
    });
    return conflicts / totalSyncs;
  }

  private async calculateSyncSuccessRate(whereCondition: any): Promise<number> {
    const totalSyncs = await this.syncEventRepository.count({
      where: whereCondition,
    });
    if (totalSyncs === 0) return 1.0;

    const successfulSyncs = await this.syncEventRepository.count({
      where: { ...whereCondition, status: SyncStatus.COMPLETED },
    });

    return successfulSyncs / totalSyncs;
  }

  private async calculateReplicationHealth(
    whereCondition: any,
  ): Promise<number> {
    // Mock implementation - would calculate based on replication lag and failures
    return 0.95;
  }

  private async getRecentAlerts(
    entityType?: string,
    limit = 10,
  ): Promise<IntegrityAlert[]> {
    // Mock implementation - would retrieve stored alerts
    return [];
  }

  private async storeAlert(alert: IntegrityAlert): Promise<void> {
    // Mock implementation - would store alert in database
    this.logger.log(`Storing alert: ${alert.id}`);
  }

  private async getMonitoredEntityTypes(): Promise<string[]> {
    const entityTypes = await this.syncEventRepository
      .createQueryBuilder('sync_event')
      .select('DISTINCT sync_event.entityType', 'entityType')
      .getRawMany();

    return entityTypes.map((row) => row.entityType);
  }
}
