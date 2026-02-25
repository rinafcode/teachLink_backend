import { IsString, IsEmail, IsEnum, IsNumber, IsOptional, IsDateString } from 'class-validator';
import { PaymentMethod } from '../entities/payment.entity';

export enum SubscriptionInterval {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
  QUARTERLY = 'quarterly',
  WEEKLY = 'weekly',
}

export class CreateSubscriptionDto {
  @IsString()
  courseId: string;

  @IsString()
  interval: SubscriptionInterval;

  @IsEnum(PaymentMethod)
  provider: string;

  @IsString()
  priceId: string;

  @IsOptional()
  metadata?: Record<string, any>;
}