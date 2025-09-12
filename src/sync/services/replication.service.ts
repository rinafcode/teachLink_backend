import { Injectable, Logger } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  type ReplicationStatus,
  ReplicationState,
} from '../entities/replication-status.entity';
import type { SyncEvent } from '../entities/sync-event.entity';
import type { ReplicationConfig } from '../interfaces/sync.interfaces';
import { MoreThan } from 'typeorm';

@Injectable()
export class ReplicationService {
  private readonly logger = new Logger(ReplicationService.name);
  private readonly replicationChannels = new Map<string, any>();

  constructor(
    private readonly replicationStatusRepository: Repository<ReplicationStatus>,
    private readonly syncEventRepository: Repository<SyncEvent>,
  ) {}

  async setupReplication(
    entityType: string,
    sourceRegion: string,
    targetRegions: string[],
    config: ReplicationConfig,
  ): Promise<void> {
    for (const targetRegion of targetRegions) {
      const replicationStatus = this.replicationStatusRepository.create({
        entityType,
        sourceRegion,
        targetRegion,
        state: ReplicationState.ACTIVE,
        configuration: config,
        lastSyncedVersion: 0,
        pendingEvents: 0,
        failedEvents: 0,
        lagSeconds: 0,
      });

      await this.replicationStatusRepository.save(replicationStatus);
      this.logger.log(
        `Replication setup for ${entityType} from ${sourceRegion} to ${targetRegion}`,
      );
    }
  }

  async replicateEvent(
    syncEvent: SyncEvent,
    config: ReplicationConfig,
  ): Promise<void> {
    if (!config.enabled) return;

    const sourceRegion = syncEvent.region;
    const targetRegions = config.regions.filter(
      (region) => region !== sourceRegion,
    );

    for (const targetRegion of targetRegions) {
      try {
        await this.replicateToRegion(syncEvent, targetRegion, config);
        await this.updateReplicationStatus(
          syncEvent.entityType,
          sourceRegion,
          targetRegion,
          {
            lastSyncedVersion: syncEvent.version,
            lastSyncTime: new Date(),
            lagSeconds: 0,
          },
        );
      } catch (error) {
        this.logger.error(
          `Replication failed from ${sourceRegion} to ${targetRegion}: ${error.message}`,
        );
        await this.updateReplicationStatus(
          syncEvent.entityType,
          sourceRegion,
          targetRegion,
          {
            state: ReplicationState.ERROR,
            lastError: error.message,
            failedEvents: 1,
          },
        );
      }
    }
  }

  async pauseReplication(
    entityType: string,
    sourceRegion: string,
    targetRegion: string,
  ): Promise<void> {
    await this.updateReplicationStatus(entityType, sourceRegion, targetRegion, {
      state: ReplicationState.PAUSED,
    });

    this.logger.log(
      `Replication paused for ${entityType} from ${sourceRegion} to ${targetRegion}`,
    );
  }

  async resumeReplication(
    entityType: string,
    sourceRegion: string,
    targetRegion: string,
  ): Promise<void> {
    await this.updateReplicationStatus(entityType, sourceRegion, targetRegion, {
      state: ReplicationState.ACTIVE,
      lastError: null,
    });

    // Trigger catch-up replication
    await this.performCatchUpReplicationForTarget(
      entityType,
      sourceRegion,
      targetRegion,
    );

    this.logger.log(
      `Replication resumed for ${entityType} from ${sourceRegion} to ${targetRegion}`,
    );
  }

  async getReplicationLag(
    entityType: string,
    sourceRegion: string,
    targetRegion: string,
  ): Promise<number> {
    const status = await this.replicationStatusRepository.findOne({
      where: { entityType, sourceRegion, targetRegion },
    });

    if (!status || !status.lastSyncTime) return -1;

    const lagMs = Date.now() - status.lastSyncTime.getTime();
    return Math.floor(lagMs / 1000);
  }

  async getReplicationStatus(
    entityType?: string,
  ): Promise<ReplicationStatus[]> {
    const whereCondition = entityType ? { entityType } : {};
    return this.replicationStatusRepository.find({
      where: whereCondition,
      order: { createdAt: 'DESC' },
    });
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async monitorReplicationHealth(): Promise<void> {
    const activeReplications = await this.replicationStatusRepository.find({
      where: { state: ReplicationState.ACTIVE },
    });

    for (const replication of activeReplications) {
      const lag = await this.calculateReplicationLag(replication);
      const maxLag = replication.configuration?.maxLag || 300; // 5 minutes default

      if (lag > maxLag) {
        this.logger.warn(
          `High replication lag detected: ${replication.entityType} ${replication.sourceRegion}->${replication.targetRegion} (${lag}s)`,
        );

        await this.updateReplicationStatus(
          replication.entityType,
          replication.sourceRegion,
          replication.targetRegion,
          {
            lagSeconds: lag,
          },
        );
      }
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async performCatchUpReplication(): Promise<void> {
    const laggedReplications = await this.replicationStatusRepository.find({
      where: { state: ReplicationState.ACTIVE },
    });

    for (const replication of laggedReplications) {
      if (replication.lagSeconds > 60) {
        // More than 1 minute lag
        await this.performCatchUpReplicationForTarget(
          replication.entityType,
          replication.sourceRegion,
          replication.targetRegion,
        );
      }
    }
  }

  private async replicateToRegion(
    syncEvent: SyncEvent,
    targetRegion: string,
    config: ReplicationConfig,
  ): Promise<void> {
    // Get replication channel for target region
    const channel = this.replicationChannels.get(targetRegion);
    if (!channel) {
      throw new Error(
        `No replication channel configured for region: ${targetRegion}`,
      );
    }

    // Create replication payload
    const replicationPayload = {
      eventId: syncEvent.id,
      entityType: syncEvent.entityType,
      entityId: syncEvent.entityId,
      eventType: syncEvent.eventType,
      payload: syncEvent.payload,
      version: syncEvent.version,
      timestamp: syncEvent.timestamp,
      sourceRegion: syncEvent.region,
      targetRegion,
    };

    // Send to target region
    await channel.send(replicationPayload);

    this.logger.debug(
      `Replicated event ${syncEvent.id} to region ${targetRegion}`,
    );
  }

  private async updateReplicationStatus(
    entityType: string,
    sourceRegion: string,
    targetRegion: string,
    updates: Partial<ReplicationStatus>,
  ): Promise<void> {
    await this.replicationStatusRepository.update(
      { entityType, sourceRegion, targetRegion },
      { ...updates, updatedAt: new Date() },
    );
  }

  private async calculateReplicationLag(
    replication: ReplicationStatus,
  ): Promise<number> {
    if (!replication.lastSyncTime) return -1;

    const lagMs = Date.now() - replication.lastSyncTime.getTime();
    return Math.floor(lagMs / 1000);
  }

  private async performCatchUpReplicationForTarget(
    entityType: string,
    sourceRegion: string,
    targetRegion: string,
  ): Promise<void> {
    const status = await this.replicationStatusRepository.findOne({
      where: { entityType, sourceRegion, targetRegion },
    });
    if (!status) return;
    // Get events since last sync
    const missedEvents = await this.syncEventRepository.find({
      where: {
        entityType,
        region: sourceRegion,
        version: MoreThan(status.lastSyncedVersion),
      },
      order: { version: 'ASC' },
      take: 1000, // Process in batches
    });
    this.logger.log(
      `Performing catch-up replication: ${missedEvents.length} events for ${entityType} ${sourceRegion}->${targetRegion}`,
    );
    for (const event of missedEvents) {
      try {
        await this.replicateToRegion(
          event,
          targetRegion,
          status.configuration as ReplicationConfig,
        );
        await this.updateReplicationStatus(
          entityType,
          sourceRegion,
          targetRegion,
          {
            lastSyncedVersion: event.version,
            lastSyncTime: new Date(),
          },
        );
      } catch (error) {
        this.logger.error(
          `Catch-up replication failed for event ${event.id}: ${error.message}`,
        );
        break; // Stop on first error to maintain order
      }
    }
  }
}
