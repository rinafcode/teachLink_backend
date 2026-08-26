import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  NotFoundException,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SubscriptionsService } from './subscriptions.service';
import {
  PauseSubscriptionDto,
  ResumeSubscriptionDto,
  UpgradeSubscriptionDto,
  DowngradeSubscriptionDto,
} from './dto/subscription-action.dto';
import { Subscription } from '../entities/subscription.entity';
import { Idempotent } from '../../common/decorators/idempotency.decorator';

@ApiTags('Subscriptions')
@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  /**
   * Get current user's active subscription
   */
  @Get('me')
  @ApiOperation({ summary: 'Get current user subscription' })
  @ApiResponse({
    status: 200,
    description: 'User subscription retrieved successfully',
    type: Subscription,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 404, description: 'No active subscription found' })
  async getUserSubscription(@Request() req: any): Promise<Subscription | null> {
    const subscription = await this.subscriptionsService.getUserSubscription(req.user.id);
    if (!subscription) {
      throw new NotFoundException('No active subscription found');
    }
    return subscription;
  }

  /**
   * Get subscription by ID
   */
  @Get(':subscriptionId')
  @ApiOperation({ summary: 'Get subscription by ID' })
  @ApiParam({ name: 'subscriptionId', description: 'Subscription ID' })
  @ApiResponse({ status: 200, description: 'Subscription retrieved successfully', type: Subscription })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async getSubscription(@Param('subscriptionId') subscriptionId: string): Promise<Subscription> {
    return this.subscriptionsService.getSubscription(subscriptionId);
  }

  /**
   * Get subscription by ID, verifying ownership
   */
  @Get(':subscriptionId/ownership')
  @ApiOperation({ summary: 'Get subscription by ID with ownership verification' })
  @ApiParam({ name: 'subscriptionId', description: 'Subscription ID' })
  @ApiResponse({ status: 200, description: 'Subscription retrieved successfully', type: Subscription })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 404, description: 'Subscription not found for this user' })
  async getSubscriptionForUser(
    @Param('subscriptionId') subscriptionId: string,
    @Request() req: any,
  ): Promise<Subscription> {
    return this.subscriptionsService.getSubscriptionForUser(subscriptionId, req.user.id);
  }

  /**
   * Pause a subscription
   */
  @Patch(':subscriptionId/pause')
  @ApiOperation({ summary: 'Pause a subscription' })
  @ApiParam({ name: 'subscriptionId', description: 'Subscription ID' })
  @ApiResponse({
    status: 200,
    description: 'Subscription paused successfully',
    type: Subscription,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 400, description: 'Invalid subscription state or pause request' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async pauseSubscription(
    @Param('subscriptionId') subscriptionId: string,
    @Body() dto: PauseSubscriptionDto,
  ): Promise<Subscription> {
    try {
      return await this.subscriptionsService.pauseSubscription(subscriptionId, dto);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException((error as Error).message);
    }
  }

  /**
   * Resume a paused subscription
   */
  @Patch(':subscriptionId/resume')
  @ApiOperation({ summary: 'Resume a paused subscription' })
  @ApiParam({ name: 'subscriptionId', description: 'Subscription ID' })
  @ApiResponse({
    status: 200,
    description: 'Subscription resumed successfully',
    type: Subscription,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 400, description: 'Subscription is not paused or invalid resume request' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async resumeSubscription(
    @Param('subscriptionId') subscriptionId: string,
    @Body() dto: ResumeSubscriptionDto,
  ): Promise<Subscription> {
    try {
      return await this.subscriptionsService.resumeSubscription(subscriptionId, dto);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException((error as Error).message);
    }
  }

  /**
   * Upgrade a subscription
   */
  @Post(':subscriptionId/upgrade')
  @Idempotent()
  @ApiOperation({ summary: 'Upgrade subscription to a higher plan' })
  @ApiParam({ name: 'subscriptionId', description: 'Subscription ID' })
  @ApiResponse({
    status: 200,
    description: 'Subscription upgraded successfully',
    type: Subscription,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 400, description: 'Invalid upgrade request or payment failed' })
  @ApiResponse({ status: 402, description: 'Payment required - Prorated charge failed' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async upgradeSubscription(
    @Param('subscriptionId') subscriptionId: string,
    @Body() dto: UpgradeSubscriptionDto,
  ): Promise<Subscription> {
    try {
      return await this.subscriptionsService.upgradeSubscription(subscriptionId, dto);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException((error as Error).message);
    }
  }

  /**
   * Downgrade a subscription
   */
  @Post(':subscriptionId/downgrade')
  @Idempotent()
  @ApiOperation({ summary: 'Downgrade subscription to a lower plan' })
  @ApiParam({ name: 'subscriptionId', description: 'Subscription ID' })
  @ApiResponse({
    status: 200,
    description: 'Subscription downgraded successfully',
    type: Subscription,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 400, description: 'Invalid downgrade request or credit issuance failed' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async downgradeSubscription(
    @Param('subscriptionId') subscriptionId: string,
    @Body() dto: DowngradeSubscriptionDto,
  ): Promise<Subscription> {
    try {
      return await this.subscriptionsService.downgradeSubscription(subscriptionId, dto);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException((error as Error).message);
    }
  }

  /**
   * Cancel a subscription
   */
  @Delete(':subscriptionId')
  @ApiOperation({ summary: 'Cancel a subscription' })
  @ApiParam({ name: 'subscriptionId', description: 'Subscription ID' })
  @ApiResponse({ status: 204, description: 'Subscription cancelled successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing JWT token' })
  @ApiResponse({ status: 400, description: 'Subscription is already cancelled' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelSubscription(@Param('subscriptionId') subscriptionId: string): Promise<void> {
    await this.subscriptionsService.cancelSubscription(subscriptionId);
  }
}
