import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PayoutsService } from './payouts.service';
import { UpdatePayoutSettingsDto, ProcessPayoutDto } from './dto/payout.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';
import { Idempotent } from '../../common/decorators/idempotency.decorator';

@ApiTags('Payouts')
@Controller('payments/payouts')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Authentication required' })
@ApiResponse({ status: 403, description: 'Insufficient role for this payout operation' })
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Get('revenue')
  @Roles(UserRole.INSTRUCTOR, UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get revenue breakdown by course for current instructor' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (1-indexed)' })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    type: Number,
    description: 'Items per page (max 100)',
  })
  @ApiResponse({ status: 200, description: 'Returns paginated revenue breakdown with summary' })
  @ApiResponse({ status: 400, description: "'page'/'pageSize' must be positive integers" })
  async getRevenueBreakdown(
    @Request() req,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const parsedPage = this.parsePositiveInt(page, 'page');
    const parsedPageSize = this.parsePositiveInt(pageSize, 'pageSize');
    return this.payoutsService.getRevenueBreakdown(req.user.id, {
      page: parsedPage,
      pageSize: parsedPageSize,
    });
  }

  @Get('settings')
  @Roles(UserRole.INSTRUCTOR, UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get payout profile settings for current instructor' })
  @ApiResponse({ status: 200, description: 'Returns payout settings profile' })
  async getPayoutProfile(@Request() req) {
    return this.payoutsService.getPayoutProfile(req.user.id);
  }

  @Put('settings')
  @Roles(UserRole.INSTRUCTOR, UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update payout profile settings for current instructor' })
  @ApiResponse({ status: 200, description: 'Returns updated settings' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  async updatePayoutProfile(@Request() req, @Body() dto: UpdatePayoutSettingsDto) {
    return this.payoutsService.updatePayoutProfile(req.user.id, dto);
  }

  @Get('historical')
  @Roles(UserRole.INSTRUCTOR, UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get historical payouts list for current instructor' })
  @ApiResponse({ status: 200, description: 'Returns list of historical payout transactions' })
  async getHistoricalPayouts(@Request() req) {
    return this.payoutsService.getHistoricalPayouts(req.user.id);
  }

  @Post('admin/process')
  @Roles(UserRole.ADMIN)
  @Idempotent()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process a payout for an instructor (Admin only)' })
  @ApiResponse({ status: 200, description: 'Payout processed successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 404, description: 'Instructor or payout profile not found' })
  @ApiResponse({ status: 409, description: 'Duplicate payout request (idempotency conflict)' })
  async processPayout(@Body() dto: ProcessPayoutDto) {
    return this.payoutsService.processPayout(dto.instructorId, dto.amount);
  }

  private parsePositiveInt(raw: string | undefined, field: string): number | undefined {
    if (raw === undefined || raw === '') {
      return undefined;
    }
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new BadRequestException(`Query parameter '${field}' must be a positive integer`);
    }
    return parsed;
  }
}
