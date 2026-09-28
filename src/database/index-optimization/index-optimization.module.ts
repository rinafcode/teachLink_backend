import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IndexOptimizationController } from './index-optimization.controller';
import { IndexOptimizationService } from './index-optimization.service';
import { QueryAnalysisService } from './services/query-analysis.service';
import { IndexCreationService } from './services/index-creation.service';
import { IndexUsageMonitorService } from './services/index-usage-monitor.service';
import { StaleIndexService } from './services/stale-index.service';

/**
 * IndexOptimizationModule wires the automatic database index optimizer:
 *   - QueryAnalysisService      → index recommendations
 *   - IndexCreationService      → automatic index creation
 *   - IndexUsageMonitorService  → index usage monitoring
 *   - StaleIndexService         → stale index removal
 *   - IndexOptimizationService  → scheduled orchestration of the above
 *
 * Requires a configured TypeORM DataSource (PostgreSQL) and, for scheduling,
 * ScheduleModule.forRoot() registered at the application root. The scheduled
 * cycle is inert unless INDEX_OPT_ENABLED=true.
 */
@Module({
  imports: [TypeOrmModule.forFeature([])],
  controllers: [IndexOptimizationController],
  providers: [
    IndexOptimizationService,
    QueryAnalysisService,
    IndexCreationService,
    IndexUsageMonitorService,
    StaleIndexService,
  ],
  exports: [
    IndexOptimizationService,
    QueryAnalysisService,
    IndexUsageMonitorService,
    StaleIndexService,
  ],
})
export class IndexOptimizationModule {}
