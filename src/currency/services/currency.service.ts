import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExchangeRateService } from './exchange-rate.service';

/**
 * Currency Service
 * Handles all currency-related operations including conversion and localization
 */
@Injectable()
export class CurrencyService {
  private readonly defaultCurrency = 'USD';

  constructor(
    private readonly exchangeRateService: ExchangeRateService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Convert an amount from one currency to another
   * @param amount The amount to convert
   * @param fromCurrency The source currency code (ISO 4217)
   * @param toCurrency The target currency code (ISO 4217)
   * @returns The converted amount
   */
  async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
  ): Promise<number> {
    if (fromCurrency === toCurrency) {
      return amount;
    }

    const exchangeRate = await this.exchangeRateService.getExchangeRate(
      fromCurrency,
      toCurrency,
    );

    return Number((amount * exchangeRate).toFixed(2));
  }

  /**
   * Convert amount to multiple currencies
   * @param amount The amount to convert
   * @param fromCurrency The source currency code
   * @param toCurrencies Array of target currency codes
   * @returns Object with converted amounts for each currency
   */
  async convertToMultipleCurrencies(
    amount: number,
    fromCurrency: string,
    toCurrencies: string[],
  ): Promise<Record<string, number>> {
    const conversions: Record<string, number> = {};

    for (const currency of toCurrencies) {
      conversions[currency] = await this.convertCurrency(
        amount,
        fromCurrency,
        currency,
      );
    }

    return conversions;
  }

  /**
   * Get formatted price string with currency symbol
   * @param amount The amount to format
   * @param currency The currency code
   * @param locale The locale for formatting
   * @returns Formatted price string
   */
  formatPrice(
    amount: number,
    currency: string,
    locale: string = 'en-US',
  ): string {
    try {
      const formatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return formatter.format(amount);
    } catch (error) {
      return `${currency} ${amount.toFixed(2)}`;
    }
  }

  /**
   * Get currency details
   * @param currencyCode ISO 4217 currency code
   * @returns Currency details
   */
  getCurrencyDetails(currencyCode: string): {
    code: string;
    symbol: string;
    name: string;
  } {
    const currencyMap: Record<string, { symbol: string; name: string }> = {
      USD: { symbol: '$', name: 'US Dollar' },
      EUR: { symbol: '€', name: 'Euro' },
      GBP: { symbol: '£', name:'British Pound' },
      JPY: { symbol: '¥', name: 'Japanese Yen' },
      INR: { symbol: '₹', name: 'Indian Rupee' },
      CAD: { symbol: 'C$', name: 'Canadian Dollar' },
      AUD: { symbol: 'A$', name: 'Australian Dollar' },
      CHF: { symbol: 'CHF', name: 'Swiss Franc' },
      CNY: { symbol: '¥', name: 'Chinese Yuan' },
      SEK: { symbol: 'kr', name: 'Swedish Krona' },
      NZD: { symbol: 'NZ$', name: 'New Zealand Dollar' },
      MXN: { symbol: '$', name: 'Mexican Peso' },
      SGD: { symbol: 'S$', name: 'Singapore Dollar' },
      HKD: { symbol: 'HK$', name: 'Hong Kong Dollar' },
      NOK: { symbol: 'kr', name: 'Norwegian Krone' },
      KRW: { symbol: '₩', name: 'South Korean Won' },
      TRY: { symbol: '₺', name: 'Turkish Lira' },
      RUB: { symbol: '₽', name: 'Russian Ruble' },
      BRL: { symbol: 'R$', name: 'Brazilian Real' },
      ZAR: { symbol: 'R', name: 'South African Rand' },
    };

    const details = currencyMap[currencyCode.toUpperCase()];
    return {
      code: currencyCode.toUpperCase(),
      symbol: details?.symbol || '$',
      name: details?.name || currencyCode,
    };
  }

  /**
   * Round amount to currency precision
   * @param amount The amount to round
   * @param currency The currency code (most currencies use 2 decimal places)
   * @returns Rounded amount
   */
  roundAmount(amount: number, currency: string = 'USD'): number {
    // Most currencies use 2 decimal places, except JPY, KRW, etc. which use 0
    const zeroDecimalCurrencies = ['JPY', 'KRW', 'VND', 'CLP'];
    const decimals = zeroDecimalCurrencies.includes(currency.toUpperCase())
      ? 0
      : 2;

    return Number(amount.toFixed(decimals));
  }

  /**
   * Validate currency code format
   * @param currencyCode The currency code to validate
   * @returns True if valid ISO 4217 code format
   */
  isValidCurrencyCode(currencyCode: string): boolean {
    return /^[A-Z]{3}$/.test(currencyCode.toUpperCase());
  }

  /**
   * Get default currency
   * @returns The default currency code
   */
  getDefaultCurrency(): string {
    return this.defaultCurrency;
  }
}
