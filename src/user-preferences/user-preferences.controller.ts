import { Controller, Get, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { UserPreferencesService } from './user-preferences.service';
import { UpdateUserPreferenceDto } from './dto/update-user-preference.dto';
import { UserPreferenceResponseDto } from './dto/user-preference-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('user-preferences')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users/:userId/preferences')
export class UserPreferencesController {
  constructor(private readonly userPreferencesService: UserPreferencesService) {}

  @Get()
  @ApiOperation({ summary: 'Get user preferences' })
  @ApiResponse({
    status: 200,
    description: 'The user preferences',
    type: UserPreferenceResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized — valid JWT required' })
  @ApiResponse({ status: 404, description: 'Preferences not found for the user' })
  getPreferences(@Param('userId') userId: string) {
    return this.userPreferencesService.getPreferences(userId);
  }

  @Patch()
  @ApiOperation({ summary: 'Update user preferences' })
  @ApiResponse({
    status: 200,
    description: 'The updated user preferences',
    type: UserPreferenceResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid preference payload' })
  @ApiResponse({ status: 401, description: 'Unauthorized — valid JWT required' })
  @ApiResponse({ status: 404, description: 'Preferences not found for the user' })
  updatePreferences(@Param('userId') userId: string, @Body() dto: UpdateUserPreferenceDto) {
    return this.userPreferencesService.updatePreferences(userId, dto);
  }

  @Delete()
  @ApiOperation({ summary: 'Reset preferences to defaults' })
  @ApiResponse({
    status: 200,
    description: 'The reset user preferences',
    type: UserPreferenceResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized — valid JWT required' })
  @ApiResponse({ status: 404, description: 'Preferences not found for the user' })
  resetPreferences(@Param('userId') userId: string) {
    return this.userPreferencesService.resetPreferences(userId);
  }
}
