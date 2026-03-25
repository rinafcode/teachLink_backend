import { IsString, IsEnum, IsOptional } from 'class-validator';
import { PaymentMethod } from '../entities/payment.entity';
import { SubscriptionInterval } from '../entities/subscription.entity';

export class CreateSubscriptionDto {
  @IsString()
  courseId: string;

  @IsEnum(SubscriptionInterval)
  interval: SubscriptionInterval;

  @IsEnum(PaymentMethod)
  provider: PaymentMethod;

  @IsString()
  priceId: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
