import { Injectable } from '@nestjs/common';
import { CurrencyService } from '../../currency/services/currency.service';
import { ExchangeRateService } from '../../currency/services/exchange-rate.service';
import { PricingDto, LocalizedPriceDto } from '../../currency/dtos/currency.dto';

/**
 * Pricing Service
 * Handles localized pricing display for courses and products
 */
@Injectable()
export class PricingService {
  constructor(
    private readonly currencyService: CurrencyService,
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

  /**
   * Get localized pricing for a product
   * @param basePrice The base price in the base currency
   * @param baseCurrency The base currency code
   * @param userCurrency The user's preferred currency
   * @param userLocale The user's locale for formatting
   * @returns Localized price information
   */
  async getLocalizedPrice(
    basePrice: number,
    baseCurrency: string,
    userCurrency: string,
    userLocale: string = 'en-US',
  ): Promise<LocalizedPriceDto> {
    const convertedAmount = await this.currencyService.convertCurrency(
      basePrice,
      baseCurrency,
      userCurrency,
    );

    const exchangeRate = await this.exchangeRateService.getExchangeRate(baseCurrency, userCurrency);

    const formattedPrice = this.currencyService.formatPrice(
      convertedAmount,
      userCurrency,
      userLocale,
    );

    const currencyDetails = this.currencyService.getCurrencyDetails(userCurrency);

    return {
      baseAmount: basePrice,
      baseCurrency,
      convertedAmount: Number(convertedAmount.toFixed(2)),
      targetCurrency: userCurrency,
      formattedPrice,
      currencySymbol: currencyDetails.symbol,
      exchangeRate,
      locale: userLocale,
    };
  }

  /**
   * Get pricing info for payment processing
   * @param basePrice The base price
   * @param baseCurrency The base currency
   * @param paymentCurrency The currency for payment processing
   * @returns Pricing DTO with all necessary information
   */
  async getPricingForPayment(
    basePrice: number,
    baseCurrency: string,
    paymentCurrency: string,
  ): Promise<PricingDto> {
    const convertedAmount = await this.currencyService.convertCurrency(
      basePrice,
      baseCurrency,
      paymentCurrency,
    );

    const exchangeRate = await this.exchangeRateService.getExchangeRate(
      baseCurrency,
      paymentCurrency,
    );

    const formattedPrice = this.currencyService.formatPrice(convertedAmount, paymentCurrency);

    // Round to currency precision
    const roundedPrice = this.currencyService.roundAmount(convertedAmount, paymentCurrency);

    return {
      basePrice,
      baseCurrency,
      localPrice: roundedPrice,
      localCurrency: paymentCurrency,
      exchangeRate,
      formattedPrice,
    };
  }

  /**
   * Get multiple currency pricing options
   * @param basePrice The base price
   * @param baseCurrency The base currency
   * @param targetCurrencies Array of target currencies
   * @returns Pricing for each currency
   */
  async getMultiCurrencyPricing(
    basePrice: number,
    baseCurrency: string,
    targetCurrencies: string[],
  ): Promise<Record<string, PricingDto>> {
    const pricingMap: Record<string, PricingDto> = {};

    for (const currency of targetCurrencies) {
      pricingMap[currency] = await this.getPricingForPayment(basePrice, baseCurrency, currency);
    }

    return pricingMap;
  }

  /**
   * Apply discount to localized price
   * @param price The price DTO
   * @param discountPercent The discount percentage (0-100)
   * @returns Updated pricing with discount applied
   */
  applyDiscount(price: PricingDto, discountPercent: number): PricingDto {
    const discountMultiplier = (100 - discountPercent) / 100;

    return {
      ...price,
      localPrice: Number((price.localPrice * discountMultiplier).toFixed(2)),
      formattedPrice: this.currencyService.formatPrice(
        price.localPrice * discountMultiplier,
        price.localCurrency,
      ),
    };
  }

  /**
   * Apply tax to localized price
   * @param price The price DTO
   * @param taxPercent The tax percentage
   * @returns Updated pricing with tax applied
   */
  applyTax(price: PricingDto, taxPercent: number): PricingDto {
    const taxMultiplier = (100 + taxPercent) / 100;

    return {
      ...price,
      localPrice: Number((price.localPrice * taxMultiplier).toFixed(2)),
      formattedPrice: this.currencyService.formatPrice(
        price.localPrice * taxMultiplier,
        price.localCurrency,
      ),
    };
  }
}
