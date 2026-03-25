import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsPositive,
  IsUUID,
  Min,
  Max,
} from 'class-validator';
import { PaymentMethod } from '../entities/payment.entity';

export class CreatePaymentDto {
  @IsUUID('4', { message: 'courseId must be a valid UUID v4' })
  courseId: string;

  @IsNumber({}, { message: 'Amount must be a numeric value' })
  @IsPositive({ message: 'Amount must be strictly positive' })
  @Min(0.5, { message: 'Minimum checkout amount is 0.5' })
  @Max(1000000, { message: 'Amount exceeds maximum limit' })
  amount: number;

  @IsString({ message: 'Currency must be a string code' })
  @IsOptional()
  currency?: string = 'USD';

  @IsEnum(PaymentMethod, { message: 'Invalid payment method selected' })
  @IsOptional()
  method?: PaymentMethod;

  @IsString()
  @IsOptional()
  provider?: string = 'stripe';

  @IsOptional()
  metadata?: Record<string, unknown>;
}
