import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QUEUE_NAMES, JOB_NAMES } from '../../common/constants/queue.constants';
import { TIME } from '../../common/constants/time.constants';
import { enrichWithCorrelation } from '../../queues/utils/correlation-job.util';
import { EntityManager, BaseEntity } from '@mikro-orm/core';
import { MetricsService } from '../../utils/masking/metrics.service';
import { Gauge } from 'prom-client';

export interface IReplicationEvent {
  entityId: string;
  sourceRegion: string;
  targetRegion: string;
  sourceModel: string;
  version: number;
  data: Record<string, any>;
  timestamp: Date;
}

interface IVersionedEntity extends BaseEntity {
  version: number;
}

/**
 * Provides replication operations.
 */
@Injectable()
export class ReplicationService implements OnModuleInit {
  private readonly logger = new Logger(ReplicationService.name);
  private readonly currentRegion: string;
  private readonly allRegions: string[];
  private readonly replicationLagSeconds: Gauge<string>;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue(QUEUE_NAMES.SYNC_TASKS)
    private readonly syncQueue: Queue,
    private readonly entityManager: EntityManager,
    private readonly metricsService: MetricsService,
  ) {
    this.currentRegion = this.configService.getOrThrow<string>('REGION');
    this.allRegions = this.configService
      .getOrThrow<string>('REPLICATION_REGIONS')
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);

    this.replicationLagSeconds = new Gauge({
      name: 'replication_lag_seconds',
      help: 'Lag in seconds between when a replication event is created and when it is applied',
      registers: [this.metricsService.getRegistry()],
    });
  }

  onModuleInit(): void {
    if (!this.allRegions.includes(this.currentRegion)) {
      throw new Error(
        `REGION "${this.currentRegion}" is not present in REPLICATION_REGIONS "${this.allRegions.join(',')}"`,
      );
    }
  }

  async replicateToRegion(
    entityId: string,
    sourceModel: string,
    version: number,
    data: unknown,
    targetRegion: string,
  ): Promise<void> {
    if (targetRegion === this.currentRegion) {
      this.logger.debug(`Skipping replication to current region: ${this.currentRegion}`);
      return;
    }

    this.logger.log(`Replicating ${entityId} from ${this.currentRegion} to ${targetRegion}`);

    const event: IReplicationEvent = {
      entityId,
      sourceRegion: this.currentRegion,
      targetRegion,
      sourceModel,
      version,
      data,
      timestamp: new Date(),
    };

    await this.syncQueue.add(
      JOB_NAMES.REPLICATE_DATA,
      enrichWithCorrelation(event as unknown as Record<string, unknown>),
      {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: TIME.TWO_SECONDS_MS,
        },
      },
    );

    this.eventEmitter.emit('data.replication.started', event);
  }

  async broadcastToAllRegions(
    entityId: string,
    sourceModel: string,
    version: number,
    data: unknown,
  ): Promise<void> {
    this.logger.log(`Broadcasting ${entityId} to all regions`);

    const replicationPromises = this.allRegions
      .filter((region) => region !== this.currentRegion)
      .map((region) => this.replicateToRegion(entityId, sourceModel, version, data, region));

    await Promise.all(replicationPromises);
  }

  async handleIncomingReplication(event: IReplicationEvent): Promise<void> {
    this.logger.log(`Received replication for ${event.entityId} from ${event.sourceRegion}`);

    const lag = (new Date().getTime() - new Date(event.timestamp).getTime()) / 1000;
    this.replicationLagSeconds.set(lag);

    try {
      await this.entityManager.transactional(async (em) => {
        const meta = (this.entityManager as any).getMetadata().get(event.sourceModel);
        const entity = await em.findOne(meta.class, { id: event.entityId });

        if (entity) {
          const versionedEntity = entity as IVersionedEntity;
          if (versionedEntity.version >= event.version) {
            this.logger.log(
              `Skipping replication for ${event.entityId} from ${event.sourceRegion} - local version ${versionedEntity.version} is newer or same than event version ${event.version}`,
            );
            return;
          }
        }

        const dataToUpsert = {
          ...event.data,
          id: event.entityId,
          version: event.version,
        };

        await em.getRepository(meta.class).upsert(dataToUpsert);
      });
    } catch (error) {
      this.logger.error(
        `Failed to apply replication for ${event.entityId} from ${event.sourceRegion}`,
        error.stack,
      );
      // Re-throwing the error will cause the job to be retried
      throw error;
    }

    this.eventEmitter.emit('data.replication.received', event);
  }
}
