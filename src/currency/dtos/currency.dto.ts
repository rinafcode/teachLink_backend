import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

/**
 * DTO for currency conversion request
 */
export class ConvertCurrencyDto {
  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  fromCurrency: string;

  @IsString()
  toCurrency: string;
}

/**
 * DTO for currency conversion response
 */
export class ConvertCurrencyResponseDto {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  convertedAmount: number;
  exchangeRate: number;
  timestamp: Date;
}

/**
 * DTO for user location
 */
export class UserLocationDto {
  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;
}

/**
 * DTO for localized price
 */
export class LocalizedPriceDto {
  baseAmount: number;
  baseCurrency: string;
  convertedAmount: number;
  targetCurrency: string;
  formattedPrice: string;
  currencySymbol: string;
  exchangeRate: number;
  locale: string;
}

/**
 * DTO for multi-currency conversion
 */
export class MultiCurrencyConversionDto {
  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  fromCurrency: string;

  @IsOptional()
  toCurrencies?: string[];
}

/**
 * DTO for multi-currency conversion response
 */
export class MultiCurrencyConversionResponseDto {
  baseAmount: number;
  baseCurrency: string;
  conversions: Record<string, number>;
  timestamp: Date;
}

/**
 * DTO for currency details
 */
export class CurrencyDetailsDto {
  code: string;
  symbol: string;
  name: string;
}

/**
 * DTO for detect currency request
 */
export class DetectCurrencyDto {
  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;
}

/**
 * DTO for detect currency response
 */
export class DetectCurrencyResponseDto {
  detectedCurrency: string;
  currencyDetails: CurrencyDetailsDto;
  confidence: 'high' | 'medium' | 'low';
  detectionMethod: string;
}

/**
 * DTO for pricing with currency
 */
export class PricingDto {
  basePrice: number;
  baseCurrency: string;
  localPrice: number;
  localCurrency: string;
  exchangeRate: number;
  formattedPrice: string;
}
