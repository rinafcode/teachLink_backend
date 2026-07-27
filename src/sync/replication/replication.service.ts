import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QUEUE_NAMES, JOB_NAMES } from '../../common/constants/queue.constants';
import { TIME } from '../../common/constants/time.constants';
import { enrichWithCorrelation } from '../../queues/utils/correlation-job.util';

export interface IReplicationEvent {
  entityId: string;
  sourceRegion: string;
  targetRegion: string;
  data: unknown;
  timestamp: Date;
}

/**
 * Provides replication operations.
 */
@Injectable()
export class ReplicationService implements OnModuleInit {
  private readonly logger = new Logger(ReplicationService.name);
  private readonly currentRegion: string;
  private readonly allRegions: string[];

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue(QUEUE_NAMES.SYNC_TASKS)
    private readonly syncQueue: Queue,
  ) {
    this.currentRegion = this.configService.getOrThrow<string>('REGION');
    this.allRegions = this.configService
      .getOrThrow<string>('REPLICATION_REGIONS')
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);
  }

  onModuleInit(): void {
    if (!this.allRegions.includes(this.currentRegion)) {
      throw new Error(
        `REGION "${this.currentRegion}" is not present in REPLICATION_REGIONS "${this.allRegions.join(',')}"`,
      );
    }
  }

  async replicateToRegion(entityId: string, data: unknown, targetRegion: string): Promise<void> {
    if (targetRegion === this.currentRegion) {
      this.logger.debug(`Skipping replication to current region: ${this.currentRegion}`);
      return;
    }

    this.logger.log(`Replicating ${entityId} from ${this.currentRegion} to ${targetRegion}`);

    const event: IReplicationEvent = {
      entityId,
      sourceRegion: this.currentRegion,
      targetRegion,
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

  async broadcastToAllRegions(entityId: string, data: unknown): Promise<void> {
    this.logger.log(`Broadcasting ${entityId} to all regions`);

    const replicationPromises = this.allRegions
      .filter((region) => region !== this.currentRegion)
      .map((region) => this.replicateToRegion(entityId, data, region));

    await Promise.all(replicationPromises);
  }

  async handleIncomingReplication(event: IReplicationEvent): Promise<void> {
    this.logger.log(`Received replication for ${event.entityId} from ${event.sourceRegion}`);
    this.eventEmitter.emit('data.replication.received', event);
  }
}
