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
 * DTO for localized payment creation
 * Includes user's currency for automatic conversion
 */
export class CreateLocalizedPaymentDto {
  @IsUUID('4', { message: 'courseId must be a valid UUID v4' })
  courseId: string;

  @IsNumber({}, { message: 'Amount must be a numeric value' })
  @IsPositive({ message: 'Amount must be strictly positive' })
  @Min(0.5, { message: 'Minimum checkout amount is 0.5' })
  @Max(1000000, { message: 'Amount exceeds maximum limit' })
  baseAmount: number;

  @IsString({ message: 'Base currency must be a string code' })
  baseCurrency: string;

  @IsString({ message: 'User currency must be a string code' })
  @IsOptional()
  userCurrency?: string = 'USD';

  @IsEnum(PaymentMethod, { message: 'Invalid payment method selected' })
  @IsOptional()
  method?: PaymentMethod;

  @IsString()
  @IsOptional()
  provider?: string = 'stripe';

  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  userCountryCode?: string;
}

/**
 * Response DTO for localized payment
 */
export class LocalizedPaymentResponseDto {
  paymentId: string;
  baseAmount: number;
  baseCurrency: string;
  convertedAmount: number;
  paymentCurrency: string;
  exchangeRate: number;
  formattedPrice: string;
  status: string;
  provider: string;
  timestamp: Date;
}

/**
 * DTO for payment with exchange rate info
 */
export class PaymentWithExchangeRateDto {
  amount: number;
  currency: string;
  exchangeRate?: number;
  originalCurrency?: string;
  originalAmount?: number;
  metadata?: Record<string, unknown>;
}
