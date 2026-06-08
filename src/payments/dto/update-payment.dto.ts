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

/**
 * Defines the update Payment payload.
 */
export class UpdatePaymentDto {
  @IsUUID('4', { message: 'courseId must be a valid UUID v4' })
  @IsOptional()
  courseId?: string;

  @IsNumber({}, { message: 'Amount must be a numeric value' })
  @IsPositive({ message: 'Amount must be strictly positive' })
  @Min(0.5, { message: 'Minimum checkout amount is 0.5' })
  @Max(1000000, { message: 'Amount exceeds maximum limit' })
  @IsOptional()
  amount?: number;

  @IsString({ message: 'Currency must be a string code' })
  @IsOptional()
  currency?: string;

  @IsEnum(PaymentMethod, { message: 'Invalid payment method selected' })
  @IsOptional()
  method?: PaymentMethod;

  @IsString()
  @IsOptional()
  provider?: string;

  @IsOptional()
  metadata?: Record<string, unknown>;
}
