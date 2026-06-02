import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NAMES } from '../common/constants/queue.constants';
import { CachingModule } from '../caching/caching.module';
import { SyncService } from './sync.service';
import { DataConsistencyService } from './consistency/data-consistency.service';
import { ConflictResolutionService } from './conflicts/conflict-resolution.service';
import { CacheInvalidationService } from '../caching/cache-invalidation.service';
import { ReplicationService } from './replication/replication.service';

/**
 * Registers the sync module.
 */
@Module({
  imports: [
    CachingModule,
    BullModule.registerQueue({
      name: QUEUE_NAMES.SYNC_TASKS,
    }),
  ],
  providers: [
    SyncService,
    DataConsistencyService,
    ConflictResolutionService,
    ReplicationService,
  ],
  exports: [
    SyncService,
    DataConsistencyService,
    ConflictResolutionService,
    CacheInvalidationService,
    ReplicationService,
  ],
})
export class SyncModule {}
