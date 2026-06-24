import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConvertCurrencyDto {
  @ApiProperty({ description: 'Amount to convert', example: 100.0, minimum: 0 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ description: 'Source currency code (ISO 4217)', example: 'USD' })
  @IsString()
  fromCurrency: string;

  @ApiProperty({ description: 'Target currency code (ISO 4217)', example: 'EUR' })
  @IsString()
  toCurrency: string;
}

export class ConvertCurrencyResponseDto {
  @ApiProperty({ description: 'Original amount', example: 100.0 })
  amount: number;

  @ApiProperty({ description: 'Source currency', example: 'USD' })
  fromCurrency: string;

  @ApiProperty({ description: 'Target currency', example: 'EUR' })
  toCurrency: string;

  @ApiProperty({ description: 'Converted amount', example: 91.5 })
  convertedAmount: number;

  @ApiProperty({ description: 'Exchange rate used', example: 0.915 })
  exchangeRate: number;

  @ApiProperty({ description: 'Conversion timestamp' })
  timestamp: Date;
}

export class UserLocationDto {
  @ApiPropertyOptional({ description: 'Country name', example: 'United States' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'Country ISO code', example: 'US' })
  @IsOptional()
  @IsString()
  countryCode?: string;

  @ApiPropertyOptional({ description: 'Timezone', example: 'America/New_York' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ description: 'City name', example: 'New York' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'IP address', example: '192.168.1.1' })
  @IsOptional()
  @IsString()
  ipAddress?: string;
}

export class LocalizedPriceDto {
  @ApiProperty({ description: 'Base price amount', example: 49.99 })
  baseAmount: number;

  @ApiProperty({ description: 'Base currency', example: 'USD' })
  baseCurrency: string;

  @ApiProperty({ description: 'Converted amount', example: 45.5 })
  convertedAmount: number;

  @ApiProperty({ description: 'Target currency', example: 'EUR' })
  targetCurrency: string;

  @ApiProperty({ description: 'Formatted price string', example: '€45.50' })
  formattedPrice: string;

  @ApiProperty({ description: 'Currency symbol', example: '€' })
  currencySymbol: string;

  @ApiProperty({ description: 'Exchange rate used', example: 0.91 })
  exchangeRate: number;

  @ApiProperty({ description: 'Locale used for formatting', example: 'de-DE' })
  locale: string;
}

export class MultiCurrencyConversionDto {
  @ApiProperty({ description: 'Amount to convert', example: 100.0, minimum: 0 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ description: 'Source currency code', example: 'USD' })
  @IsString()
  fromCurrency: string;

  @ApiPropertyOptional({ description: 'Target currencies', example: ['EUR', 'GBP', 'JPY'] })
  @IsOptional()
  toCurrencies?: string[];
}

export class MultiCurrencyConversionResponseDto {
  @ApiProperty({ description: 'Base amount', example: 100.0 })
  baseAmount: number;

  @ApiProperty({ description: 'Base currency', example: 'USD' })
  baseCurrency: string;

  @ApiProperty({ description: 'Currency conversion map', example: { EUR: 91.5, GBP: 79.2 } })
  conversions: Record<string, number>;

  @ApiProperty({ description: 'Conversion timestamp' })
  timestamp: Date;
}

export class CurrencyDetailsDto {
  @ApiProperty({ description: 'Currency code (ISO 4217)', example: 'USD' })
  code: string;

  @ApiProperty({ description: 'Currency symbol', example: '$' })
  symbol: string;

  @ApiProperty({ description: 'Currency name', example: 'US Dollar' })
  name: string;
}

export class DetectCurrencyDto {
  @ApiPropertyOptional({ description: 'Country ISO code', example: 'US' })
  @IsOptional()
  @IsString()
  countryCode?: string;

  @ApiPropertyOptional({ description: 'Country name', example: 'United States' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'Timezone', example: 'America/New_York' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ description: 'IP address', example: '192.168.1.1' })
  @IsOptional()
  @IsString()
  ipAddress?: string;
}

export class DetectCurrencyResponseDto {
  @ApiProperty({ description: 'Detected currency code', example: 'USD' })
  detectedCurrency: string;

  @ApiProperty({ description: 'Currency details' })
  currencyDetails: CurrencyDetailsDto;

  @ApiProperty({ description: 'Detection confidence level', enum: ['high', 'medium', 'low'] })
  confidence: 'high' | 'medium' | 'low';

  @ApiProperty({ description: 'Detection method used', example: 'geolocation' })
  detectionMethod: string;
}

export class PricingDto {
  @ApiProperty({ description: 'Base price', example: 49.99 })
  basePrice: number;

  @ApiProperty({ description: 'Base currency', example: 'USD' })
  baseCurrency: string;

  @ApiProperty({ description: 'Localized price', example: 45.5 })
  localPrice: number;

  @ApiProperty({ description: 'Local currency', example: 'EUR' })
  localCurrency: string;

  @ApiProperty({ description: 'Exchange rate', example: 0.91 })
  exchangeRate: number;

  @ApiProperty({ description: 'Formatted price string', example: '€45.50' })
  formattedPrice: string;
}
