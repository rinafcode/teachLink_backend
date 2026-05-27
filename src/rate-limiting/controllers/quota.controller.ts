import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { QuotaDefinitionService } from '../services/quota-definition.service';
import { QuotaTrackingService } from '../services/quota-tracking.service';
import {
  CreateQuotaDefinitionDto,
  UpdateQuotaDefinitionDto,
  ResetUserQuotaDto,
  QuotaStatusDto,
} from '../dto/quota.dto';
import { UserTier } from '../rate-limiting.constants';
import { SkipQuota } from '../decorators/quota.decorator';

@ApiTags('Quota Management')
@SkipQuota()   // Admin endpoints are exempt from quota checks
@Controller('admin/quota')
export class QuotaController {
  constructor(
    private readonly definitions: QuotaDefinitionService,
    private readonly tracking: QuotaTrackingService,
  ) {}

  // ─── Quota Definitions ────────────────────────────────────────────────────

  @Post('definitions')
  @ApiOperation({ summary: 'Create a quota definition (tier or per-user override)' })
  @ApiResponse({ status: 201, description: 'Quota definition created' })
  create(@Body() dto: CreateQuotaDefinitionDto) {
    return this.definitions.create(dto);
  }

  @Get('definitions')
  @ApiOperation({ summary: 'List all quota definitions' })
  findAll() {
    return this.definitions.findAll();
  }

  @Get('definitions/:id')
  @ApiOperation({ summary: 'Get a single quota definition' })
  @ApiParam({ name: 'id', type: String })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.definitions.findOne(id);
  }

  @Patch('definitions/:id')
  @ApiOperation({ summary: 'Update a quota definition' })
  @ApiParam({ name: 'id', type: String })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuotaDefinitionDto,
  ) {
    return this.definitions.update(id, dto);
  }

  @Delete('definitions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a quota definition' })
  @ApiParam({ name: 'id', type: String })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.definitions.remove(id);
  }

  // ─── User Quota Status & Management ──────────────────────────────────────

  @Get('users/:userId/status')
  @ApiOperation({ summary: "Get a user's current quota status across all windows" })
  @ApiParam({ name: 'userId', type: String })
  @ApiResponse({ status: 200, type: QuotaStatusDto })
  async getUserStatus(@Param('userId') userId: string): Promise<QuotaStatusDto> {
    // Default to FREE; in a real setup resolve the user's tier from the users service
    return this.tracking.getStatus(userId, UserTier.FREE);
  }

  @Post('users/reset')
  @ApiOperation({ summary: 'Manually reset quota for a specific user' })
  @ApiResponse({ status: 200, description: 'Quota reset successfully' })
  async resetUser(@Body() dto: ResetUserQuotaDto) {
    await this.tracking.resetUser(dto.userId, dto.period);
    return { message: `Quota reset for user ${dto.userId}`, period: dto.period ?? 'ALL' };
  }

  @Post('reset/minutely')
  @ApiOperation({ summary: 'Trigger minutely quota window reset (all users)' })
  async triggerMinutelyReset() {
    const count = await this.tracking.resetExpiredWindows('MINUTELY');
    return { reset: count, period: 'MINUTELY' };
  }

  @Post('reset/hourly')
  @ApiOperation({ summary: 'Trigger hourly quota window reset (all users)' })
  async triggerHourlyReset() {
    const count = await this.tracking.resetExpiredWindows('HOURLY');
    return { reset: count, period: 'HOURLY' };
  }

  @Post('reset/daily')
  @ApiOperation({ summary: 'Trigger daily quota window reset (all users)' })
  async triggerDailyReset() {
    const count = await this.tracking.resetExpiredWindows('DAILY');
    return { reset: count, period: 'DAILY' };
  }
}
