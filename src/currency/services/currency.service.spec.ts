import { ConfigService } from '@nestjs/config';
import { CurrencyService } from './currency.service';
import { ExchangeRateService } from './exchange-rate.service';

describe('CurrencyService', () => {
  const exchangeRateService = {
    getExchangeRate: jest.fn().mockResolvedValue(0.9),
  } as unknown as ExchangeRateService;

  const configService = { get: jest.fn() } as unknown as ConfigService;
  let service: CurrencyService;

  beforeEach(() => {
    service = new CurrencyService(exchangeRateService, configService);
    jest.restoreAllMocks();
  });

  it('returns the same amount when currencies match', async () => {
    await expect(service.convertCurrency(10, 'USD', 'USD')).resolves.toBe(10);
    expect(exchangeRateService.getExchangeRate).not.toHaveBeenCalled();
  });

  it('converts to another currency using the exchange rate service', async () => {
    await expect(service.convertCurrency(10, 'USD', 'EUR')).resolves.toBe(9);
    expect(exchangeRateService.getExchangeRate).toHaveBeenCalledWith('USD', 'EUR');
  });

  it('converts to multiple currencies', async () => {
    const spy = jest.spyOn(service, 'convertCurrency').mockImplementation(async (_a, _f, to) => {
      return to === 'EUR' ? 9 : 8;
    });

    await expect(service.convertToMultipleCurrencies(10, 'USD', ['EUR', 'GBP'])).resolves.toEqual({
      EUR: 9,
      GBP: 8,
    });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('formats prices and falls back when Intl formatting fails', () => {
    expect(service.formatPrice(10, 'USD')).toContain('$');

    const original = Intl.NumberFormat;
    (Intl as any).NumberFormat = jest.fn(() => {
      throw new Error('boom');
    });

    expect(service.formatPrice(10, 'USD')).toBe('USD 10.00');
    (Intl as any).NumberFormat = original;
  });

  it('returns currency details', () => {
    expect(service.getCurrencyDetails('eur')).toEqual({
      code: 'EUR',
      symbol: '€',
      name: 'Euro',
    });
  });

  it('rounds zero-decimal currencies correctly', () => {
    expect(service.roundAmount(10.55, 'JPY')).toBe(11);
  });

  it('validates currency codes and returns the default currency', () => {
    expect(service.isValidCurrencyCode('USD')).toBe(true);
    expect(service.isValidCurrencyCode('US')).toBe(false);
    expect(service.getDefaultCurrency()).toBe('USD');
  });
});
