import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConflictResolutionService, ConflictResolutionStrategy, SyncData } from './conflicts/conflict-resolution.service';
import { DataConsistencyService } from './consistency/data-consistency.service';
import { CacheInvalidationService } from './cache/cache-invalidation.service';
import { ReplicationService } from './replication/replication.service';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private conflictResolution: ConflictResolutionService,
    private consistencyService: DataConsistencyService,
    private cacheInvalidation: CacheInvalidationService,
    private replicationService: ReplicationService,
  ) {}

  /**
   * Synchronizes data between two sources.
   */
  async synchronize(
    localData: SyncData,
    remoteData: SyncData,
    strategy: ConflictResolutionStrategy = ConflictResolutionStrategy.LAST_WRITE_WINS,
  ): Promise<SyncData> {
    this.logger.log(`Starting synchronization for ${localData.id}`);

    // Resolve any conflicts
    const resolvedData = this.conflictResolution.resolve(localData, remoteData, strategy);

    // Ensure consistency
    await this.consistencyService.scheduleConsistencyTask(resolvedData.id, resolvedData.data);

    // Invalidate cache
    await this.cacheInvalidation.handleDataChange('entity', resolvedData.id);

    // Replicate to other regions
    await this.replicationService.broadcastToAllRegions(resolvedData.id, resolvedData.data);

    this.logger.log(`Synchronization completed for ${resolvedData.id}`);
    return resolvedData;
  }

  @OnEvent('data.updated')
  async handleDataUpdate(payload: { entity: string; id: string; data: any }) {
    this.logger.log(`Handling data update event for ${payload.entity}:${payload.id}`);
    
    // Invalidate cache immediately on update
    await this.cacheInvalidation.handleDataChange(payload.entity, payload.id);
    
    // Broadcast change
    await this.replicationService.broadcastToAllRegions(payload.id, payload.data);
  }
}
