import { IsNotEmpty, IsNumber, IsString, IsEnum, IsOptional, IsUUID, Min, IsObject, IsDateString } from 'class-validator';
import { BillingInterval } from '../entities/subscription.entity';

export class CreateSubscriptionDto {
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsNotEmpty()
  @IsString()
  currency: string;

  @IsNotEmpty()
  @IsEnum(BillingInterval)
  billingInterval: BillingInterval;

  @IsOptional()
  @IsDateString()
  trialEnd?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
} 