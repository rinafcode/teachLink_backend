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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '../entities/payment.entity';

export class CreateLocalizedPaymentDto {
  @ApiProperty({
    description: 'Course ID to purchase',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4', { message: 'courseId must be a valid UUID v4' })
  courseId: string;

  @ApiProperty({
    description: 'Base amount in the original currency',
    example: 49.99,
    minimum: 0.5,
    maximum: 1000000,
  })
  @IsNumber({}, { message: 'Amount must be a numeric value' })
  @IsPositive({ message: 'Amount must be strictly positive' })
  @Min(0.5, { message: 'Minimum checkout amount is 0.5' })
  @Max(1000000, { message: 'Amount exceeds maximum limit' })
  baseAmount: number;

  @ApiProperty({ description: 'Base currency code (ISO 4217)', example: 'USD' })
  @IsString({ message: 'Base currency must be a string code' })
  baseCurrency: string;

  @ApiPropertyOptional({ description: 'User preferred currency for conversion', example: 'EUR' })
  @IsString({ message: 'User currency must be a string code' })
  @IsOptional()
  userCurrency?: string = 'USD';

  @ApiPropertyOptional({ description: 'Payment method', enum: PaymentMethod })
  @IsEnum(PaymentMethod, { message: 'Invalid payment method selected' })
  @IsOptional()
  method?: PaymentMethod;

  @ApiPropertyOptional({ description: 'Payment provider', example: 'stripe' })
  @IsString()
  @IsOptional()
  provider?: string = 'stripe';

  @ApiPropertyOptional({ description: 'Additional payment metadata' })
  @IsOptional()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'User country code for localized pricing', example: 'DE' })
  @IsOptional()
  @IsString()
  userCountryCode?: string;
}

export class LocalizedPaymentResponseDto {
  @ApiProperty({ description: 'Payment ID' })
  paymentId: string;

  @ApiProperty({ description: 'Base amount in the original currency', example: 49.99 })
  baseAmount: number;

  @ApiProperty({ description: 'Base currency code', example: 'USD' })
  baseCurrency: string;

  @ApiProperty({ description: 'Converted amount in user currency', example: 45.5 })
  convertedAmount: number;

  @ApiProperty({ description: 'Payment currency after conversion', example: 'EUR' })
  paymentCurrency: string;

  @ApiProperty({ description: 'Exchange rate used for conversion', example: 0.91 })
  exchangeRate: number;

  @ApiProperty({ description: 'Formatted price string', example: '€45.50' })
  formattedPrice: string;

  @ApiProperty({ description: 'Payment status' })
  status: string;

  @ApiProperty({ description: 'Payment provider' })
  provider: string;

  @ApiProperty({ description: 'Payment timestamp' })
  timestamp: Date;
}

export class PaymentWithExchangeRateDto {
  @ApiProperty({ description: 'Payment amount', example: 49.99 })
  amount: number;

  @ApiProperty({ description: 'Payment currency', example: 'USD' })
  currency: string;

  @ApiPropertyOptional({ description: 'Exchange rate applied', example: 0.91 })
  exchangeRate?: number;

  @ApiPropertyOptional({ description: 'Original currency before conversion', example: 'EUR' })
  originalCurrency?: string;

  @ApiPropertyOptional({ description: 'Original amount before conversion', example: 45.5 })
  originalAmount?: number;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  metadata?: Record<string, unknown>;
}
