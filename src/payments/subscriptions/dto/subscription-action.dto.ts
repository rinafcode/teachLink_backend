import { IsOptional, IsString } from 'class-validator';

export enum SubscriptionAction {
  PAUSE = 'pause',
  RESUME = 'resume',
  UPGRADE = 'upgrade',
  DOWNGRADE = 'downgrade',
  CANCEL = 'cancel',
}

export class PauseSubscriptionDto {
  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  resumeAt?: string; // ISO date string
}

export class ResumeSubscriptionDto {
  @IsString()
  @IsOptional()
  reason?: string;
}

export class UpgradeSubscriptionDto {
  @IsString()
  planId: string; // Target plan ID

  @IsString()
  @IsOptional()
  billingCycle?: string; // 'monthly', 'yearly', etc.
}

export class DowngradeSubscriptionDto {
  @IsString()
  planId: string; // Target plan ID

  @IsString()
  @IsOptional()
  billingCycle?: string; // 'monthly', 'yearly', etc.

  @IsString()
  @IsOptional()
  prorationType?: string; // 'immediate', 'next_billing_cycle', 'credit'
}

export class SubscriptionResponseDto {
  id: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: Date;
  amount: number;
  currency: string;
  interval: string;
}
