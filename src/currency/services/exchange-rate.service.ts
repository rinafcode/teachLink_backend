import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface ExchangeRates {
  [currency: string]: number;
}

/**
 * Exchange Rate Service
 * Fetches and caches exchange rates for currency conversion
 */
@Injectable()
export class ExchangeRateService implements OnModuleInit {
  private readonly logger = new Logger(ExchangeRateService.name);
  private exchangeRates: ExchangeRates = {};
  private lastUpdated: Date = new Date(0);
  private readonly updateIntervalMs = 24 * 60 * 60 * 1000; // 24 hours
  private readonly baseCurrency = 'USD';

  // Fallback exchange rates if API is unavailable (as of 2026)
  private readonly fallbackRates: ExchangeRates = {
    EUR: 0.92,
    GBP: 0.79,
    JPY: 149.5,
    INR: 83.12,
    CAD: 1.36,
    AUD: 1.53,
    CHF: 0.89,
    CNY: 7.24,
    SEK: 10.65,
    NZD: 1.65,
    MXN: 17.05,
    SGD: 1.35,
    HKD: 7.81,
    NOK: 10.55,
    KRW: 1310.5,
    TRY: 32.45,
    RUB: 92.5,
    BRL: 4.97,
    ZAR: 18.55,
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refreshExchangeRates();
  }

  /**
   * Get exchange rate between two currencies
   * @param fromCurrency Source currency code
   * @param toCurrency Target currency code
   * @returns Exchange rate
   */
  async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();

    if (from === to) {
      return 1;
    }

    // Refresh rates if needed
    if (this.shouldRefreshRates()) {
      await this.refreshExchangeRates();
    }

    // If either currency is not base, calculate indirect rate
    const fromRate = this.exchangeRates[from] || 1;
    const toRate = this.exchangeRates[to] || 1;

    if (from === this.baseCurrency) {
      return toRate;
    }

    if (to === this.baseCurrency) {
      return 1 / fromRate;
    }

    return toRate / fromRate;
  }

  /**
   * Refresh exchange rates from external API
   */
  async refreshExchangeRates(): Promise<void> {
    try {
      const _apiKey = this.configService.get<string>(
        'EXCHANGE_RATE_API_KEY',
        'fixer', // Default to fixer.io free tier
      );
      const apiUrl = this.configService.get<string>(
        'EXCHANGE_RATE_API_URL',
        'https://api.exchangerate-api.com/v4/latest/USD',
      );

      try {
        const response = await firstValueFrom(
          this.httpService.get(apiUrl, {
            timeout: 5000,
          }),
        );

        if (response.data?.rates) {
          this.exchangeRates = response.data.rates;
          this.lastUpdated = new Date();
          this.logger.log('Exchange rates updated successfully');
        }
      } catch (apiError) {
        this.logger.warn('Failed to fetch exchange rates from API, using fallback rates', apiError);
        this.exchangeRates = this.fallbackRates;
        this.lastUpdated = new Date();
      }
    } catch (error) {
      this.logger.error('Error refreshing exchange rates', error);
      if (Object.keys(this.exchangeRates).length === 0) {
        this.exchangeRates = this.fallbackRates;
      }
    }
  }

  /**
   * Check if exchange rates should be refreshed
   */
  private shouldRefreshRates(): boolean {
    const now = new Date();
    return now.getTime() - this.lastUpdated.getTime() > this.updateIntervalMs;
  }

  /**
   * Get all available exchange rates
   * @returns Object with all exchange rates
   */
  getAvailableRates(): ExchangeRates {
    return { ...this.exchangeRates };
  }

  /**
   * Get exchange rates as of a specific date (not implemented in free tier)
   * @param date The date for historical rates
   * @returns Exchange rates for that date
   */
  async getHistoricalRates(_date: Date): Promise<ExchangeRates> {
    // For production, integrate with a service that supports historical rates
    // For now, return current rates
    return this.getAvailableRates();
  }
}
