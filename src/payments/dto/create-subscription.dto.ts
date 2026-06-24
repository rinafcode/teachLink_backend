import { IsString, IsEnum, IsOptional, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '../entities/payment.entity';
import { SubscriptionInterval } from '../entities/subscription.entity';

export class CreateSubscriptionDto {
  @ApiProperty({
    description: 'Course ID to subscribe to',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  courseId: string;

  @ApiProperty({ description: 'Billing interval', enum: SubscriptionInterval, example: 'monthly' })
  @IsEnum(SubscriptionInterval)
  @IsNotEmpty()
  interval: SubscriptionInterval;

  @ApiProperty({ description: 'Payment provider', enum: PaymentMethod, example: 'stripe' })
  @IsEnum(PaymentMethod)
  @IsNotEmpty()
  provider: PaymentMethod;

  @ApiProperty({ description: 'Price plan ID', example: 'price_1Q...' })
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  priceId: string;

  @ApiPropertyOptional({ description: 'Additional subscription metadata' })
  @IsOptional()
  @IsString()
  metadata?: Record<string, unknown>;
}
