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
  SubscriptionResponseDto,
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
    description: 'User subscription',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'No active subscription' })
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
  @ApiResponse({ status: 200, description: 'Subscription', type: SubscriptionResponseDto })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async getSubscription(@Param('subscriptionId') subscriptionId: string): Promise<Subscription> {
    return this.subscriptionsService.getSubscription(subscriptionId);
  }

  /**
   * Pause a subscription
   */
  @Patch(':subscriptionId/pause')
  @ApiOperation({ summary: 'Pause a subscription' })
  @ApiParam({ name: 'subscriptionId', description: 'Subscription ID' })
  @ApiResponse({
    status: 200,
    description: 'Subscription paused',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid subscription state' })
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
    description: 'Subscription resumed',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Subscription is not paused' })
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
  @Idempotent({ ttl: 86400 })
  @ApiOperation({ summary: 'Upgrade subscription to a higher plan' })

  @ApiParam({ name: 'subscriptionId', description: 'Subscription ID' })
  @ApiResponse({
    status: 200,
    description: 'Subscription upgraded',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid upgrade request' })
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
  @Idempotent({ ttl: 86400 })
  @ApiOperation({ summary: 'Downgrade subscription to a lower plan' })

  @ApiParam({ name: 'subscriptionId', description: 'Subscription ID' })
  @ApiResponse({
    status: 200,
    description: 'Subscription downgraded',
    type: SubscriptionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid downgrade request' })
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
  @ApiResponse({ status: 204, description: 'Subscription cancelled' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelSubscription(@Param('subscriptionId') subscriptionId: string): Promise<void> {
    await this.subscriptionsService.cancelSubscription(subscriptionId);
  }
}
