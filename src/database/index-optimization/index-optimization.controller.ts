import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { UserRole } from '../../users/entities/user.entity';
import { IndexOptimizationService } from './index-optimization.service';
import { QueryAnalysisService } from './services/query-analysis.service';
import { IndexUsageMonitorService } from './services/index-usage-monitor.service';
import { StaleIndexService } from './services/stale-index.service';

/**
 * Admin API for the database index optimizer. Mutating endpoints require an
 * explicit `apply=true` flag so DDL is never executed by accident.
 */
@ApiTags('index-optimization')
@Controller('database/index-optimization')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class IndexOptimizationController {
  constructor(
    private readonly optimizer: IndexOptimizationService,
    private readonly analysis: QueryAnalysisService,
    private readonly usageMonitor: IndexUsageMonitorService,
    private readonly staleIndex: StaleIndexService,
  ) {}

  @Get('recommendations')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Analyse the database and return index recommendations' })
  recommendations() {
    return this.analysis.analyze();
  }

  @Get('slow-queries')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List slow statements from pg_stat_statements (if enabled)' })
  slowQueries() {
    return this.analysis.getSlowStatements();
  }

  @Get('usage')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get index usage statistics' })
  usage() {
    return this.usageMonitor.getSnapshot();
  }

  @Get('stale')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List indexes judged stale and eligible for removal' })
  stale() {
    return this.staleIndex.findStaleIndexes();
  }

  @Get('last-run')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get the summary of the last optimization cycle' })
  lastRun() {
    return this.optimizer.getLastRun() ?? { message: 'No run recorded yet' };
  }

  @Post('run')
  @Roles(UserRole.ADMIN)
  @ApiQuery({
    name: 'apply',
    required: false,
    type: Boolean,
    description: 'When true, executes DDL instead of running in dry-run mode',
  })
  @ApiOperation({ summary: 'Run a full optimization cycle (dry-run unless apply=true)' })
  run(@Query('apply') apply?: string) {
    return this.optimizer.run(apply === 'true');
  }
}
