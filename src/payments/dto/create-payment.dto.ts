import { IsString, IsNumber, IsOptional, IsEnum, IsPositive } from 'class-validator';
import { PaymentMethod } from '../entities/payment.entity';

export class CreatePaymentDto {
  @IsString()
  courseId: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  @IsOptional()
  currency?: string = 'USD';

  @IsEnum(PaymentMethod)
  @IsOptional()
  method?: PaymentMethod;

  @IsString()
  @IsOptional()
  provider?: string = 'stripe';

  @IsOptional()
  metadata?: Record<string, any>;
}
