import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PayoutsService } from './payouts.service';
import { UpdatePayoutSettingsDto, ProcessPayoutDto } from './dto/payout.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/entities/user.entity';

@ApiTags('Payouts')
@Controller('payments/payouts')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Authentication required' })
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Get('revenue')
  @Roles(UserRole.INSTRUCTOR, UserRole.TEACHER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get revenue breakdown by course for current instructor' })
  @ApiResponse({ status: 200, description: 'Returns revenue breakdown' })
  async getRevenueBreakdown(@Request() req) {
    return this.payoutsService.getRevenueBreakdown(req.user.id);
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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process a payout for an instructor (Admin only)' })
  @ApiResponse({ status: 200, description: 'Payout processed successfully' })
  async processPayout(@Body() dto: ProcessPayoutDto) {
    return this.payoutsService.processPayout(dto.instructorId, dto.amount);
  }
}
