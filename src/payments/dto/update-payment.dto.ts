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
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '../entities/payment.entity';

export class UpdatePaymentDto {
  @ApiPropertyOptional({
    description: 'Course ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4', { message: 'courseId must be a valid UUID v4' })
  @IsOptional()
  courseId?: string;

  @ApiPropertyOptional({
    description: 'Payment amount',
    example: 49.99,
    minimum: 0.5,
    maximum: 1000000,
  })
  @IsNumber({}, { message: 'Amount must be a numeric value' })
  @IsPositive({ message: 'Amount must be strictly positive' })
  @Min(0.5, { message: 'Minimum checkout amount is 0.5' })
  @Max(1000000, { message: 'Amount exceeds maximum limit' })
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional({ description: 'Currency code (ISO 4217)', example: 'USD' })
  @IsString({ message: 'Currency must be a string code' })
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({ description: 'Payment method', enum: PaymentMethod })
  @IsEnum(PaymentMethod, { message: 'Invalid payment method selected' })
  @IsOptional()
  method?: PaymentMethod;

  @ApiPropertyOptional({ description: 'Payment provider', example: 'stripe' })
  @IsString()
  @IsOptional()
  provider?: string;

  @ApiPropertyOptional({ description: 'Additional payment metadata' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}
