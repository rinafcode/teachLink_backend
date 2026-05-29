import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProfileCompletenessService } from './profile-completeness.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('profile-completeness')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users/:userId/profile-completeness')
export class ProfileCompletenessController {
  constructor(private readonly profileCompletenessService: ProfileCompletenessService) {}

  @Get()
  @ApiOperation({ summary: 'Get profile completeness score and progress for a user' })
  getScore(@Param('userId') userId: string) {
    return this.profileCompletenessService.getScore(userId);
  }
}