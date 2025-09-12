import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import type { DataSyncService } from '../services/data-sync.service';
import type { DataConsistencyService } from '../services/data-consistency.service';
import type { ConflictResolutionService } from '../services/conflict-resolution.service';
import type { CacheInvalidationService } from '../services/cache-invalidation.service';
import type { ReplicationService } from '../services/replication.service';
import type { IntegrityMonitoringService } from '../services/integrity-monitoring.service';
import type { SyncEventType, DataSource } from '../entities/sync-event.entity';
import type { CheckType } from '../entities/integrity-check.entity';
import type { SyncConfiguration } from '../interfaces/sync.interfaces';

@Controller('sync')
export class SyncController {
  constructor(
    private readonly dataSyncService: DataSyncService,
    private readonly dataConsistencyService: DataConsistencyService,
    private readonly conflictResolutionService: ConflictResolutionService,
    private readonly cacheInvalidationService: CacheInvalidationService,
    private readonly replicationService: ReplicationService,
    private readonly integrityMonitoringService: IntegrityMonitoringService,
  ) {}

  registerSyncConfiguration(config: SyncConfiguration) {
    this.dataSyncService.registerSyncConfiguration(config);
    return { message: 'Sync configuration registered successfully' };
  }

  @Post('event')
  async createSyncEvent(body: {
    entityType: string;
    entityId: string;
    eventType: SyncEventType;
    payload: Record<string, any>;
    dataSource?: DataSource;
    region?: string;
  }) {
    const { entityType, entityId, eventType, payload, dataSource, region } =
      body;

    if (!entityType || !entityId || !eventType || !payload) {
      throw new BadRequestException('Missing required fields');
    }

    const syncEventId = await this.dataSyncService.createSyncEvent(
      entityType,
      entityId,
      eventType,
      payload,
      dataSource,
      region,
    );

    return { syncEventId, message: 'Sync event created successfully' };
  }

  @Post('entity/:entityType/:entityId')
  async syncEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('source') sourceDataSource: DataSource,
    @Query('targets') targetDataSources?: string,
  ) {
    const targets = targetDataSources
      ? (targetDataSources.split(',') as DataSource[])
      : undefined;

    const result = await this.dataSyncService.syncEntity(
      entityType,
      entityId,
      sourceDataSource,
      targets,
    );

    return result;
  }

  @Post('bulk')
  async bulkSync(body: {
    entityType: string;
    entityIds: string[];
    sourceDataSource: DataSource;
  }) {
    const { entityType, entityIds, sourceDataSource } = body;

    if (!entityType || !entityIds || !sourceDataSource) {
      throw new BadRequestException('Missing required fields');
    }

    const result = await this.dataSyncService.bulkSync(
      entityType,
      entityIds,
      sourceDataSource,
    );

    return result;
  }

  @Get('events/pending')
  async getPendingSyncEvents(@Query('limit') limit?: string) {
    const limitNum = limit ? Number.parseInt(limit) : 100;
    return this.dataSyncService.getPendingSyncEvents(limitNum);
  }

  @Post('event/:id/retry')
  async retrySyncEvent(@Param('id') syncEventId: string) {
    const result = await this.dataSyncService.retrySyncEvent(syncEventId);
    return result;
  }

  @Post('consistency/check')
  async performConsistencyCheck(body: {
    entityType: string;
    dataSources: string[];
    checkType?: CheckType;
  }) {
    const { entityType, dataSources, checkType } = body;

    if (!entityType || !dataSources) {
      throw new BadRequestException('Missing required fields');
    }

    const result = await this.dataConsistencyService.performConsistencyCheck(
      entityType,
      dataSources,
      checkType,
    );

    return result;
  }

  @Get('consistency/report')
  async getConsistencyReport(
    @Query('entityType') entityType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.dataConsistencyService.getConsistencyReport(
      entityType,
      start,
      end,
    );
  }

  @Get('conflicts/history')
  async getConflictHistory(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? Number.parseInt(limit) : 100;
    return this.conflictResolutionService.getConflictHistory(
      entityType,
      entityId,
      limitNum,
    );
  }

  @Post('cache/invalidate')
  async invalidateCache(body: {
    entityType: string;
    entityId: string;
    strategy?: 'immediate' | 'lazy' | 'scheduled';
  }) {
    const { entityType, entityId, strategy } = body;

    if (!entityType || !entityId) {
      throw new BadRequestException('Missing required fields');
    }

    await this.cacheInvalidationService.invalidateEntity(
      entityType,
      entityId,
      strategy,
    );

    return { message: 'Cache invalidation initiated' };
  }

  @Post('cache/invalidate/tags')
  async invalidateCacheByTags(body: { tags: string[] }) {
    const { tags } = body;

    if (!tags || !Array.isArray(tags)) {
      throw new BadRequestException('Tags array is required');
    }

    await this.cacheInvalidationService.invalidateByTags(tags);

    return { message: 'Cache invalidation by tags initiated' };
  }

  @Post('cache/invalidate/pattern')
  async invalidateCacheByPattern(body: { pattern: string }) {
    const { pattern } = body;

    if (!pattern) {
      throw new BadRequestException('Pattern is required');
    }

    await this.cacheInvalidationService.invalidatePattern(pattern);

    return { message: 'Cache invalidation by pattern initiated' };
  }

  @Post('cache/warm')
  async warmCache(body: { entityType: string; entityId: string; data: any }) {
    const { entityType, entityId, data } = body;

    if (!entityType || !entityId || !data) {
      throw new BadRequestException('Missing required fields');
    }

    await this.cacheInvalidationService.warmCache(entityType, entityId, data);

    return { message: 'Cache warming initiated' };
  }

  @Get('cache/stats')
  async getCacheStats() {
    return this.cacheInvalidationService.getCacheStats();
  }

  @Post('replication/setup')
  async setupReplication(body: {
    entityType: string;
    sourceRegion: string;
    targetRegions: string[];
    config: any;
  }) {
    const { entityType, sourceRegion, targetRegions, config } = body;

    if (!entityType || !sourceRegion || !targetRegions || !config) {
      throw new BadRequestException('Missing required fields');
    }

    await this.replicationService.setupReplication(
      entityType,
      sourceRegion,
      targetRegions,
      config,
    );

    return { message: 'Replication setup completed' };
  }

  @Put('replication/:entityType/:sourceRegion/:targetRegion/pause')
  async pauseReplication(
    @Param('entityType') entityType: string,
    @Param('sourceRegion') sourceRegion: string,
    @Param('targetRegion') targetRegion: string,
  ) {
    await this.replicationService.pauseReplication(
      entityType,
      sourceRegion,
      targetRegion,
    );
    return { message: 'Replication paused' };
  }

  @Put('replication/:entityType/:sourceRegion/:targetRegion/resume')
  async resumeReplication(
    @Param('entityType') entityType: string,
    @Param('sourceRegion') sourceRegion: string,
    @Param('targetRegion') targetRegion: string,
  ) {
    await this.replicationService.resumeReplication(
      entityType,
      sourceRegion,
      targetRegion,
    );
    return { message: 'Replication resumed' };
  }

  @Get('replication/status')
  async getReplicationStatus(@Query('entityType') entityType?: string) {
    return this.replicationService.getReplicationStatus(entityType);
  }

  @Get('replication/lag/:entityType/:sourceRegion/:targetRegion')
  async getReplicationLag(
    @Param('entityType') entityType: string,
    @Param('sourceRegion') sourceRegion: string,
    @Param('targetRegion') targetRegion: string,
  ) {
    const lag = await this.replicationService.getReplicationLag(
      entityType,
      sourceRegion,
      targetRegion,
    );
    return { lag };
  }

  @Get('monitoring/metrics')
  async getIntegrityMetrics(
    @Query('entityType') entityType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const timeRange =
      startDate && endDate
        ? {
            start: new Date(startDate),
            end: new Date(endDate),
          }
        : undefined;

    return this.integrityMonitoringService.getIntegrityMetrics(
      entityType,
      timeRange,
    );
  }

  @Get('monitoring/health')
  async performHealthCheck() {
    return this.integrityMonitoringService.performHealthCheck();
  }
}
