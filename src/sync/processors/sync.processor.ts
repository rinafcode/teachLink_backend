import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import type { DataSyncService } from '../services/data-sync.service';
import type { CacheInvalidationService } from '../services/cache-invalidation.service';

@Processor('sync-queue')
export class SyncProcessor {
  private readonly logger = new Logger(SyncProcessor.name);

  constructor(
    private readonly dataSyncService: DataSyncService,
    private readonly cacheInvalidationService: CacheInvalidationService,
  ) {}

  @Process('process-sync-event')
  async processSyncEvent(job: Job<{ syncEventId: string }>) {
    const { syncEventId } = job.data;

    try {
      this.logger.log(`Processing sync event: ${syncEventId}`);
      const result = await this.dataSyncService.processSyncEvent(syncEventId);

      if (!result.success) {
        throw new Error(`Sync failed: ${result.errors.join(', ')}`);
      }

      this.logger.log(`Sync event ${syncEventId} processed successfully`);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to process sync event ${syncEventId}: ${error.message}`,
      );
      throw error;
    }
  }

  @Process('cache-invalidation')
  async processCacheInvalidation(
    job: Job<{ cacheKey: string; strategy: any }>,
  ) {
    const { cacheKey, strategy } = job.data;

    try {
      this.logger.log(`Processing cache invalidation: ${cacheKey}`);
      // Implementation would depend on the specific cache invalidation logic
      this.logger.log(`Cache invalidation ${cacheKey} processed successfully`);
    } catch (error) {
      this.logger.error(
        `Failed to process cache invalidation ${cacheKey}: ${error.message}`,
      );
      throw error;
    }
  }
}
