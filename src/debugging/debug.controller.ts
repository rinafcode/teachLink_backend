import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/entities/user.entity';
import { RequestCaptureService } from './services/request-capture.service';
import { RequestReplayService } from './services/request-replay.service';
import { PerformanceTimelineService } from './services/performance-timeline.service';
import { ReplayRequestDto } from './dto/replay-request.dto';

/**
 * Developer-facing debugging API. Restricted to admins because captured
 * traffic can contain sensitive payloads.
 */
@ApiTags('debugging')
@Controller('debug')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DebugController {
  constructor(
    private readonly capture: RequestCaptureService,
    private readonly replayService: RequestReplayService,
    private readonly timelines: PerformanceTimelineService,
  ) {}

  @Get('requests')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List recently captured request/response exchanges' })
  list(@Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : undefined;
    const records = this.capture.list(
      Number.isFinite(parsed) ? parsed : undefined,
    );
    // Summaries only — keep the list view light. Full payload via :id.
    return {
      total: this.capture.size,
      records: records.map((r) => ({
        id: r.id,
        timestamp: r.timestamp,
        method: r.request.method,
        path: r.request.path,
        statusCode: r.response?.statusCode,
        durationMs: r.timeline.totalDurationMs,
        hasError: Boolean(r.error),
      })),
    };
  }

  @Get('requests/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Inspect a captured request/response in full' })
  inspect(@Param('id') id: string) {
    const record = this.capture.get(id);
    if (!record) throw new NotFoundException(`No captured request "${id}"`);
    return record;
  }

  @Get('requests/:id/timeline')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get the performance timeline for a captured request' })
  timeline(@Param('id') id: string) {
    const record = this.capture.get(id);
    if (!record) throw new NotFoundException(`No captured request "${id}"`);
    return {
      ...record.timeline,
      hotspots: this.timelines.hotspots(record.timeline),
    };
  }

  @Get('requests/:id/trace')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get the enhanced stack trace for a failed request' })
  trace(@Param('id') id: string) {
    const record = this.capture.get(id);
    if (!record) throw new NotFoundException(`No captured request "${id}"`);
    if (!record.error) {
      return { message: 'Request completed without an error' };
    }
    return record.error;
  }

  @Post('requests/:id/replay')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Replay a captured request and diff the response' })
  replay(@Param('id') id: string, @Body() body: ReplayRequestDto) {
    return this.replayService.replay(id, {
      baseUrl: body?.baseUrl,
      headerOverrides: body?.headerOverrides,
      bodyOverride: body?.bodyOverride,
    });
  }

  @Delete('requests')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Clear the captured request buffer' })
  clear() {
    this.capture.clear();
    return { message: 'Debug capture buffer cleared' };
  }
}
