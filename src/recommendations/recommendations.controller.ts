import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RecommendationsService } from './recommendations.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@ApiTags('recommendations')
@Controller('recommendations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Get('personalized')
  @ApiOperation({ summary: 'Get personalized course recommendations' })
  @ApiResponse({
    status: 200,
    description: 'Returns personalized course recommendations',
  })
  async getPersonalizedRecommendations(
    @Request() req,
    @Query('limit') limit?: number,
  ): Promise<string[]> {
    return this.recommendationsService.getPersonalizedRecommendations(
      req.user.id,
      limit,
    );
  }

  @Get('similar/:courseId')
  @ApiOperation({ summary: 'Get similar courses' })
  @ApiResponse({ status: 200, description: 'Returns similar courses' })
  async getSimilarCourses(
    @Param('courseId') courseId: string,
    @Query('limit') limit?: number,
  ): Promise<string[]> {
    return this.recommendationsService.getSimilarCourses(courseId, limit);
  }

  @Post('interaction')
  @ApiOperation({ summary: 'Track user interaction with a course' })
  @ApiResponse({ status: 201, description: 'Interaction tracked successfully' })
  async trackInteraction(
    @Request() req,
    @Body()
    interaction: {
      courseId: string;
      rating?: number;
      completionRate?: number;
      timeSpent?: number;
      interactionType?: string;
      metadata?: Record<string, any>;
    },
  ): Promise<void> {
    await this.recommendationsService.trackUserInteraction(
      req.user.id,
      interaction.courseId,
      interaction,
    );
  }

  @Post('preferences')
  @ApiOperation({ summary: 'Update user preferences' })
  @ApiResponse({ status: 200, description: 'Preferences updated successfully' })
  async updatePreferences(
    @Request() req,
    @Body()
    preferences: {
      interests?: string[];
      skillLevels?: Record<string, number>;
      learningGoals?: string[];
    },
  ): Promise<void> {
    await this.recommendationsService.updateUserPreferences(
      req.user.id,
      preferences,
    );
  }
}
