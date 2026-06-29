import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CachingService } from '../../caching/caching.service';

interface ExchangeRates {
  [currency: string]: number;
}

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private readonly baseCurrency = 'USD';
  private readonly cacheTtlSeconds = 3600;
  private readonly staleTtlSeconds = 7200;

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
    private readonly cachingService: CachingService,
  ) {}

  async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();

    if (from === to) {
      return 1;
    }

    const cacheKey = `exchange-rate:${from}:${to}`;
    const staleKey = `exchange-rate:${from}:${to}:stale`;

    const fresh = await this.cachingService.get<number>(cacheKey);
    if (fresh !== undefined) {
      return fresh;
    }

    const stale = await this.cachingService.get<number>(staleKey);
    if (stale !== undefined) {
      this.refreshInBackground(from, to, cacheKey, staleKey);
      return stale;
    }

    try {
      return await this.cachingService.getOrSet(
        cacheKey,
        async () => {
          const rate = await this.fetchRateFromApi(from, to);
          await this.cachingService.set(staleKey, rate, this.staleTtlSeconds);
          return rate;
        },
        this.cacheTtlSeconds,
      );
    } catch {
      return this.computeFromFallback(from, to);
    }
  }

  private async fetchRateFromApi(from: string, to: string): Promise<number> {
    const apiUrl = this.configService.get<string>(
      'EXCHANGE_RATE_API_URL',
      'https://api.exchangerate-api.com/v4/latest/USD',
    );

    const response = await firstValueFrom(this.httpService.get(apiUrl, { timeout: 5000 }));

    if (!response.data?.rates) {
      throw new Error('Invalid API response: missing rates');
    }

    const rates: ExchangeRates = response.data.rates;
    const fromRate = rates[from] || 1;
    const toRate = rates[to] || 1;

    if (from === this.baseCurrency) {
      return toRate;
    }

    if (to === this.baseCurrency) {
      return 1 / fromRate;
    }

    return toRate / fromRate;
  }

  private async refreshInBackground(
    from: string,
    to: string,
    cacheKey: string,
    staleKey: string,
  ): Promise<void> {
    try {
      const rate = await this.fetchRateFromApi(from, to);
      await Promise.all([
        this.cachingService.set(cacheKey, rate, this.cacheTtlSeconds),
        this.cachingService.set(staleKey, rate, this.staleTtlSeconds),
      ]);
    } catch (error) {
      this.logger.warn(`Background refresh failed for ${from}:${to}`, error);
    }
  }

  private computeFromFallback(from: string, to: string): number {
    const fromRate = this.fallbackRates[from] || 1;
    const toRate = this.fallbackRates[to] || 1;

    if (from === this.baseCurrency) {
      return toRate;
    }

    if (to === this.baseCurrency) {
      return 1 / fromRate;
    }

    return toRate / fromRate;
  }

  getAvailableRates(): ExchangeRates {
    return { ...this.fallbackRates };
  }

  async refreshExchangeRates(): Promise<void> {
    this.logger.log('Exchange rate caches will refresh on next request via stale-while-revalidate');
  }

  async getHistoricalRates(_date: Date): Promise<ExchangeRates> {
    return this.getAvailableRates();
  }
}
