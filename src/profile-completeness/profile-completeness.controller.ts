import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ProfileCompletenessService } from './profile-completeness.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CustomThrottleGuard } from '../common/guards/throttle.guard';
import { THROTTLE } from '../common/constants/throttle.constants';

@ApiTags('profile-completeness')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CustomThrottleGuard)
@Controller('users/:userId/profile-completeness')
export class ProfileCompletenessController {
  constructor(private readonly profileCompletenessService: ProfileCompletenessService) {}

  @Get()
  @Throttle({ default: THROTTLE.MODERATE })
  @ApiOperation({ summary: 'Get profile completeness score and progress for a user' })
  @ApiResponse({ status: 429, description: 'Too many requests — rate limit exceeded' })
  getScore(@Param('userId') userId: string) {
    return this.profileCompletenessService.getScore(userId);
  }
}
