import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod as PaymentMethodType } from '../entities/payment.entity';

export class CreatePaymentMethodDto {
  @ApiProperty({ enum: PaymentMethodType })
  @IsEnum(PaymentMethodType)
  method: PaymentMethodType;

  @ApiPropertyOptional({ description: 'Gateway provider name' })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional({ description: 'Billing name for the payment method' })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  displayName?: string;

  @ApiPropertyOptional({ description: 'Last 4 digits of card or wallet identifier' })
  @IsOptional()
  @IsString()
  @Length(1, 4)
  last4?: string;

  @ApiPropertyOptional({
    description: 'Expiration month for card-based methods',
    minimum: 1,
    maximum: 12,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  expiryMonth?: number;

  @ApiPropertyOptional({ description: 'Expiration year for card-based methods' })
  @IsOptional()
  @IsInt()
  @Min(2024)
  expiryYear?: number;

  @ApiPropertyOptional({ description: 'Whether this payment method should become the default' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: 'Additional metadata for the payment method' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdatePaymentMethodDto {
  @ApiPropertyOptional({ enum: PaymentMethodType })
  @IsOptional()
  @IsEnum(PaymentMethodType)
  method?: PaymentMethodType;

  @ApiPropertyOptional({ description: 'Gateway provider name' })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional({ description: 'Billing name for the payment method' })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  displayName?: string;

  @ApiPropertyOptional({ description: 'Last 4 digits of card or wallet identifier' })
  @IsOptional()
  @IsString()
  @Length(1, 4)
  last4?: string;

  @ApiPropertyOptional({
    description: 'Expiration month for card-based methods',
    minimum: 1,
    maximum: 12,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  expiryMonth?: number;

  @ApiPropertyOptional({ description: 'Expiration year for card-based methods' })
  @IsOptional()
  @IsInt()
  @Min(2024)
  expiryYear?: number;

  @ApiPropertyOptional({ description: 'Toggle whether this payment method is default' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: 'Additional metadata for the payment method' })
  @IsOptional()
  metadata?: Record<string, any>;
}
