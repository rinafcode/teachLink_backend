import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
import { CreateOnboardingStepDto, UpdateOnboardingStepDto } from './dto/onboarding-step.dto';
import { UpdateProgressDto, CompleteStepDto } from './dto/onboarding-progress.dto';
import { CreateOnboardingRewardDto, UpdateOnboardingRewardDto } from './dto/onboarding-reward.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('onboarding')
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  // ─── Admin: Onboarding Steps Management ───────────────────────────────

  @Post('steps')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a new onboarding step (Admin)' })
  @ApiResponse({ status: 201, description: 'Onboarding step created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createStep(@Body() createDto: CreateOnboardingStepDto) {
    return this.onboardingService.createStep(createDto);
  }

  @Get('steps')
  @ApiOperation({ summary: 'Get all active onboarding steps' })
  @ApiResponse({ status: 200, description: 'Return all active onboarding steps' })
  async getAllSteps() {
    return this.onboardingService.findAllSteps();
  }

  @Get('steps/:id')
  @ApiOperation({ summary: 'Get onboarding step by ID' })
  @ApiParam({ name: 'id', description: 'Step ID' })
  @ApiResponse({ status: 200, description: 'Return the onboarding step' })
  @ApiResponse({ status: 404, description: 'Step not found' })
  async getStepById(@Param('id') id: string) {
    return this.onboardingService.findStepById(id);
  }

  @Put('steps/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update an onboarding step (Admin)' })
  @ApiParam({ name: 'id', description: 'Step ID' })
  @ApiResponse({ status: 200, description: 'Step updated successfully' })
  @ApiResponse({ status: 404, description: 'Step not found' })
  async updateStep(
    @Param('id') id: string,
    @Body() updateDto: UpdateOnboardingStepDto,
  ) {
    return this.onboardingService.updateStep(id, updateDto);
  }

  @Delete('steps/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete an onboarding step (Admin)' })
  @ApiParam({ name: 'id', description: 'Step ID' })
  @ApiResponse({ status: 200, description: 'Step deleted successfully' })
  @ApiResponse({ status: 404, description: 'Step not found' })
  async deleteStep(@Param('id') id: string) {
    return this.onboardingService.deleteStep(id);
  }

  // ─── User: Progress Tracking ──────────────────────────────────────────

  @Get('progress/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get user onboarding progress' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Return user onboarding progress' })
  async getUserProgress(@Param('userId') userId: string) {
    return this.onboardingService.getUserProgress(userId);
  }

  @Post('progress/:userId/steps/:stepId/start')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Start an onboarding step' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'stepId', description: 'Step ID' })
  @ApiResponse({ status: 201, description: 'Step started successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async startStep(
    @Param('userId') userId: string,
    @Param('stepId') stepId: string,
  ) {
    return this.onboardingService.startStep(userId, stepId);
  }

  @Put('progress/:userId/steps/:stepId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update progress for an onboarding step' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'stepId', description: 'Step ID' })
  @ApiResponse({ status: 200, description: 'Progress updated successfully' })
  @ApiResponse({ status: 404, description: 'Progress not found' })
  async updateProgress(
    @Param('userId') userId: string,
    @Param('stepId') stepId: string,
    @Body() updateDto: UpdateProgressDto,
  ) {
    return this.onboardingService.updateStepProgress(userId, stepId, updateDto);
  }

  @Post('progress/:userId/steps/:stepId/complete')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Complete an onboarding step and check for rewards' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'stepId', description: 'Step ID' })
  @ApiResponse({ status: 201, description: 'Step completed successfully' })
  @ApiResponse({ status: 200, description: 'Return completion result with rewards' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Progress not found' })
  async completeStep(
    @Param('userId') userId: string,
    @Param('stepId') stepId: string,
    @Body() completeDto?: CompleteStepDto,
  ) {
    return this.onboardingService.completeStep(userId, stepId, completeDto);
  }

  @Post('progress/:userId/steps/:stepId/skip')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Skip an optional onboarding step' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiParam({ name: 'stepId', description: 'Step ID' })
  @ApiResponse({ status: 201, description: 'Step skipped successfully' })
  @ApiResponse({ status: 400, description: 'Cannot skip required step' })
  async skipStep(
    @Param('userId') userId: string,
    @Param('stepId') stepId: string,
  ) {
    return this.onboardingService.skipStep(userId, stepId);
  }

  @Get('progress/:userId/next-step')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get the next incomplete onboarding step for a user' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Return the next step or null if all completed' })
  async getNextStep(@Param('userId') userId: string) {
    return this.onboardingService.getNextIncompleteStep(userId);
  }

  // ─── Admin: Rewards Management ────────────────────────────────────────

  @Post('rewards')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a new onboarding reward (Admin)' })
  @ApiResponse({ status: 201, description: 'Reward created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createReward(@Body() createDto: CreateOnboardingRewardDto) {
    return this.onboardingService.createReward(createDto);
  }

  @Get('rewards')
  @ApiOperation({ summary: 'Get all active onboarding rewards' })
  @ApiResponse({ status: 200, description: 'Return all active rewards' })
  async getAllRewards() {
    return this.onboardingService.findAllRewards();
  }

  @Get('rewards/:id')
  @ApiOperation({ summary: 'Get onboarding reward by ID' })
  @ApiParam({ name: 'id', description: 'Reward ID' })
  @ApiResponse({ status: 200, description: 'Return the onboarding reward' })
  @ApiResponse({ status: 404, description: 'Reward not found' })
  async getRewardById(@Param('id') id: string) {
    return this.onboardingService.findRewardById(id);
  }

  @Put('rewards/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update an onboarding reward (Admin)' })
  @ApiParam({ name: 'id', description: 'Reward ID' })
  @ApiResponse({ status: 200, description: 'Reward updated successfully' })
  @ApiResponse({ status: 404, description: 'Reward not found' })
  async updateReward(
    @Param('id') id: string,
    @Body() updateDto: UpdateOnboardingRewardDto,
  ) {
    return this.onboardingService.updateReward(id, updateDto);
  }

  @Delete('rewards/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete an onboarding reward (Admin)' })
  @ApiParam({ name: 'id', description: 'Reward ID' })
  @ApiResponse({ status: 200, description: 'Reward deleted successfully' })
  @ApiResponse({ status: 404, description: 'Reward not found' })
  async deleteReward(@Param('id') id: string) {
    return this.onboardingService.deleteReward(id);
  }
}
