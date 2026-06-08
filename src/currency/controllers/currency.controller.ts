import { Controller, Post, Get, Body, Query, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CurrencyService } from '../services/currency.service';
import { ExchangeRateService } from '../services/exchange-rate.service';
import { CurrencyDetectionService } from '../services/currency-detection.service';
import {
  ConvertCurrencyDto,
  ConvertCurrencyResponseDto,
  LocalizedPriceDto,
  MultiCurrencyConversionDto,
  MultiCurrencyConversionResponseDto,
  CurrencyDetailsDto,
  DetectCurrencyDto,
  DetectCurrencyResponseDto,
} from '../dtos/currency.dto';

/**
 * Currency Controller
 * Handles all currency-related API endpoints
 */
@ApiTags('Currency')
@Controller('currency')
export class CurrencyController {
  constructor(
    private readonly currencyService: CurrencyService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly currencyDetectionService: CurrencyDetectionService,
  ) {}

  /**
   * Convert currency
   * POST /currency/convert
   */
  @Post('convert')
  @HttpCode(200)
  @ApiOperation({ summary: 'Convert amount from one currency to another' })
  @ApiResponse({
    status: 200,
    description: 'Conversion successful',
    type: ConvertCurrencyResponseDto,
  })
  async convertCurrency(
    @Body() dto: ConvertCurrencyDto,
  ): Promise<ConvertCurrencyResponseDto> {
    const convertedAmount = await this.currencyService.convertCurrency(
      dto.amount,
      dto.fromCurrency,
      dto.toCurrency,
    );

    const exchangeRate = await this.exchangeRateService.getExchangeRate(
      dto.fromCurrency,
      dto.toCurrency,
    );

    return {
      amount: dto.amount,
      fromCurrency: dto.fromCurrency,
      toCurrency: dto.toCurrency,
      convertedAmount,
      exchangeRate,
      timestamp: new Date(),
    };
  }

  /**
   * Convert to multiple currencies
   * POST /currency/convert-multiple
   */
  @Post('convert-multiple')
  @HttpCode(200)
  @ApiOperation({ summary: 'Convert amount to multiple currencies' })
  @ApiResponse({
    status: 200,
    description: 'Conversion successful',
    type: MultiCurrencyConversionResponseDto,
  })
  async convertToMultiple(
    @Body() dto: MultiCurrencyConversionDto,
  ): Promise<MultiCurrencyConversionResponseDto> {
    const toCurrencies = dto.toCurrencies || [
      'EUR',
      'GBP',
      'JPY',
      'INR',
      'CAD',
      'AUD',
    ];

    const conversions = await this.currencyService.convertToMultipleCurrencies(
      dto.amount,
      dto.fromCurrency,
      toCurrencies,
    );

    return {
      baseAmount: dto.amount,
      baseCurrency: dto.fromCurrency,
      conversions,
      timestamp: new Date(),
    };
  }

  /**
   * Get currency details
   * GET /currency/details/:currencyCode
   */
  @Get('details/:currencyCode')
  @ApiOperation({ summary: 'Get currency details (symbol, name)' })
  @ApiResponse({
    status: 200,
    description: 'Currency details retrieved',
    type: CurrencyDetailsDto,
  })
  getCurrencyDetails(@Query('code') currencyCode: string): CurrencyDetailsDto {
    return this.currencyService.getCurrencyDetails(currencyCode);
  }

  /**
   * Detect currency from location
   * POST /currency/detect
   */
  @Post('detect')
  @HttpCode(200)
  @ApiOperation({ summary: 'Detect currency from user location' })
  @ApiResponse({
    status: 200,
    description: 'Currency detected',
    type: DetectCurrencyResponseDto,
  })
  detectCurrency(
    @Body() dto: DetectCurrencyDto,
  ): DetectCurrencyResponseDto {
    const detectedCurrency = this.currencyDetectionService.detectCurrency({
      country: dto.country,
      countryCode: dto.countryCode,
      timezone: dto.timezone,
    });

    const currencyDetails = this.currencyService.getCurrencyDetails(
      detectedCurrency,
    );

    let confidence: 'high' | 'medium' | 'low' = 'medium';
    let detectionMethod = 'location';

    if (dto.countryCode) {
      confidence = 'high';
      detectionMethod = 'country_code';
    } else if (dto.country) {
      confidence = 'medium';
      detectionMethod = 'country_name';
    } else if (dto.timezone) {
      confidence = 'low';
      detectionMethod = 'timezone';
    }

    return {
      detectedCurrency,
      currencyDetails,
      confidence,
      detectionMethod,
    };
  }

  /**
   * Get all supported currencies
   * GET /currency/supported
   */
  @Get('supported')
  @ApiOperation({ summary: 'Get list of all supported currencies and countries' })
  getSupportedCurrencies(): Record<string, string> {
    return this.currencyDetectionService.getSupportedCountries();
  }

  /**
   * Get current exchange rates
   * GET /currency/rates
   */
  @Get('rates')
  @ApiOperation({ summary: 'Get current exchange rates' })
  getExchangeRates(): Record<string, number> {
    return this.exchangeRateService.getAvailableRates();
  }

  /**
   * Refresh exchange rates
   * POST /currency/rates/refresh
   */
  @Post('rates/refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Manually refresh exchange rates' })
  async refreshRates(): Promise<{ message: string; timestamp: Date }> {
    await this.exchangeRateService.refreshExchangeRates();
    return {
      message: 'Exchange rates refreshed successfully',
      timestamp: new Date(),
    };
  }

  /**
   * Format price in specific currency and locale
   * POST /currency/format-price
   */
  @Post('format-price')
  @HttpCode(200)
  @ApiOperation({ summary: 'Format price for display' })
  formatPrice(
    @Body() body: { amount: number; currency: string; locale?: string },
  ): { formattedPrice: string } {
    const formattedPrice = this.currencyService.formatPrice(
      body.amount,
      body.currency,
      body.locale || 'en-US',
    );

    return { formattedPrice };
  }
}
