import { Controller, Get, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserPreferencesService } from './user-preferences.service';
import { UpdateUserPreferenceDto } from './dto/update-user-preference.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('user-preferences')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users/:userId/preferences')
export class UserPreferencesController {
  constructor(private readonly userPreferencesService: UserPreferencesService) {}

  @Get()
  @ApiOperation({ summary: 'Get user preferences' })
  getPreferences(@Param('userId') userId: string) {
    return this.userPreferencesService.getPreferences(userId);
  }

  @Patch()
  @ApiOperation({ summary: 'Update user preferences' })
  updatePreferences(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserPreferenceDto,
  ) {
    return this.userPreferencesService.updatePreferences(userId, dto);
  }

  @Delete()
  @ApiOperation({ summary: 'Reset preferences to defaults' })
  resetPreferences(@Param('userId') userId: string) {
    return this.userPreferencesService.resetPreferences(userId);
  }
}