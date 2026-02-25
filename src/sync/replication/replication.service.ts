import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

export interface ReplicationEvent {
  entityId: string;
  sourceRegion: string;
  targetRegion: string;
  data: any;
  timestamp: Date;
}

@Injectable()
export class ReplicationService {
  private readonly logger = new Logger(ReplicationService.name);
  private readonly currentRegion = process.env.REGION || 'us-east-1';

  constructor(
    private eventEmitter: EventEmitter2,
    @InjectQueue('sync-tasks') private syncQueue: Queue,
  ) {}

  /**
   * Replicates data to a target region.
   */
  async replicateToRegion(entityId: string, data: any, targetRegion: string): Promise<void> {
    if (targetRegion === this.currentRegion) {
      this.logger.debug(`Skipping replication to current region: ${this.currentRegion}`);
      return;
    }

    this.logger.log(`Replicating ${entityId} from ${this.currentRegion} to ${targetRegion}`);

    const event: ReplicationEvent = {
      entityId,
      sourceRegion: this.currentRegion,
      targetRegion,
      data,
      timestamp: new Date(),
    };

    // Add to queue for asynchronous replication
    await this.syncQueue.add('replicate-data', event, {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });

    this.eventEmitter.emit('data.replication.started', event);
  }

  /**
   * Broadcasts data to all regions except the current one.
   */
  async broadcastToAllRegions(entityId: string, data: any): Promise<void> {
    const allRegions = ['us-east-1', 'eu-west-1', 'ap-southeast-1'];
    
    this.logger.log(`Broadcasting ${entityId} to all regions`);
    
    const replicationPromises = allRegions
      .filter(region => region !== this.currentRegion)
      .map(region => this.replicateToRegion(entityId, data, region));

    await Promise.all(replicationPromises);
  }

  /**
   * Handles incoming replication data from another region.
   */
  async handleIncomingReplication(event: ReplicationEvent): Promise<void> {
    this.logger.log(`Received replication for ${event.entityId} from ${event.sourceRegion}`);
    
    // In a real app, logic to update the local database would go here.
    // This might also trigger conflict resolution if the local version is different.
    
    this.eventEmitter.emit('data.replication.received', event);
  }
}
