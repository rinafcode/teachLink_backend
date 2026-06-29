import { IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum SubscriptionAction {
  PAUSE = 'pause',
  RESUME = 'resume',
  UPGRADE = 'upgrade',
  DOWNGRADE = 'downgrade',
  CANCEL = 'cancel',
}

export class PauseSubscriptionDto {
  @ApiPropertyOptional({ description: 'Reason for pausing the subscription' })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({
    description: 'ISO date to automatically resume',
    example: '2026-07-01T00:00:00Z',
  })
  @IsString()
  @IsOptional()
  resumeAt?: string;
}

export class ResumeSubscriptionDto {
  @ApiPropertyOptional({ description: 'Reason for resuming the subscription' })
  @IsString()
  @IsOptional()
  reason?: string;
}

export class UpgradeSubscriptionDto {
  @ApiProperty({ description: 'Target plan ID to upgrade to' })
  @IsString()
  planId: string;

  @ApiPropertyOptional({ description: 'Billing cycle', example: 'monthly' })
  @IsString()
  @IsOptional()
  billingCycle?: string;
}

export class DowngradeSubscriptionDto {
  @ApiProperty({ description: 'Target plan ID to downgrade to' })
  @IsString()
  planId: string;

  @ApiPropertyOptional({ description: 'Billing cycle', example: 'monthly' })
  @IsString()
  @IsOptional()
  billingCycle?: string;

  @ApiPropertyOptional({ description: 'Proration type', example: 'next_billing_cycle' })
  @IsString()
  @IsOptional()
  prorationType?: string;
}

export class SubscriptionResponseDto {
  @ApiProperty({ description: 'Subscription ID' })
  id: string;

  @ApiProperty({ description: 'Subscription status', example: 'active' })
  status: string;

  @ApiProperty({ description: 'Current billing period start' })
  currentPeriodStart: Date;

  @ApiProperty({ description: 'Current billing period end' })
  currentPeriodEnd: Date;

  @ApiProperty({ description: 'Whether subscription cancels at period end' })
  cancelAtPeriodEnd: boolean;

  @ApiPropertyOptional({ description: 'Cancellation date' })
  cancelledAt?: Date;

  @ApiProperty({ description: 'Subscription amount', example: 29.99 })
  amount: number;

  @ApiProperty({ description: 'Currency code', example: 'USD' })
  currency: string;

  @ApiProperty({ description: 'Billing interval', example: 'monthly' })
  interval: string;
}
