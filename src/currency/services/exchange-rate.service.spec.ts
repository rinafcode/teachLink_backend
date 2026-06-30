import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { ExchangeRateService } from './exchange-rate.service';
import { CachingService } from '../../caching/caching.service';

describe('ExchangeRateService', () => {
  let service: ExchangeRateService;
  let cachingService: {
    get: jest.Mock;
    set: jest.Mock;
    getOrSet: jest.Mock;
    delete: jest.Mock;
    clear: jest.Mock;
  };
  let httpService: { get: jest.Mock };

  const mockCachingService = {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(undefined),
    getOrSet: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('https://api.example.com/v4/latest/USD'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    httpService = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExchangeRateService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: HttpService, useValue: httpService },
        { provide: CachingService, useValue: mockCachingService },
      ],
    }).compile();

    service = module.get<ExchangeRateService>(ExchangeRateService);
    cachingService = module.get(CachingService) as typeof cachingService;
  });

  describe('getExchangeRate', () => {
    it('returns 1 for same currency', async () => {
      const result = await service.getExchangeRate('USD', 'usd');
      expect(result).toBe(1);
      expect(cachingService.get).not.toHaveBeenCalled();
    });

    it('returns cached value from fresh cache without calling API', async () => {
      cachingService.get.mockResolvedValueOnce(0.92);

      const result = await service.getExchangeRate('USD', 'EUR');

      expect(result).toBe(0.92);
      expect(cachingService.get).toHaveBeenCalledWith('exchange-rate:USD:EUR');
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it('returns stale cache value and triggers background refresh', async () => {
      cachingService.get.mockResolvedValueOnce(undefined).mockResolvedValueOnce(0.92);
      httpService.get.mockReturnValue(of({ data: { rates: { EUR: 0.93 } } }));

      const result = await service.getExchangeRate('USD', 'EUR');

      expect(result).toBe(0.92);
      expect(cachingService.get).toHaveBeenNthCalledWith(1, 'exchange-rate:USD:EUR');
      expect(cachingService.get).toHaveBeenNthCalledWith(2, 'exchange-rate:USD:EUR:stale');

      await new Promise(process.nextTick);
      expect(httpService.get).toHaveBeenCalledTimes(1);
      expect(cachingService.set).toHaveBeenCalledWith('exchange-rate:USD:EUR', 0.93, 3600);
      expect(cachingService.set).toHaveBeenCalledWith('exchange-rate:USD:EUR:stale', 0.93, 7200);
    });

    it('fetches from API on complete miss and caches result', async () => {
      cachingService.get.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);
      cachingService.getOrSet.mockImplementationOnce(
        async (_key: string, factory: () => Promise<number>) => factory(),
      );
      httpService.get.mockReturnValue(of({ data: { rates: { EUR: 0.92 } } }));

      const result = await service.getExchangeRate('USD', 'EUR');

      expect(result).toBe(0.92);
      expect(cachingService.getOrSet).toHaveBeenCalledWith(
        'exchange-rate:USD:EUR',
        expect.any(Function),
        3600,
      );
      expect(cachingService.set).toHaveBeenCalledWith('exchange-rate:USD:EUR:stale', 0.92, 7200);
    });

    it('falls back to stale cache when API fails on complete miss', async () => {
      cachingService.get.mockResolvedValueOnce(undefined).mockResolvedValueOnce(0.85);
      cachingService.getOrSet.mockRejectedValueOnce(new Error('API error'));

      const result = await service.getExchangeRate('GBP', 'EUR');

      expect(result).toBe(0.85);
    });

    it('falls back to hardcoded rates when all caches miss and API fails', async () => {
      cachingService.get.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);
      cachingService.getOrSet.mockRejectedValueOnce(new Error('API error'));

      const result = await service.getExchangeRate('USD', 'EUR');

      expect(result).toBe(0.92);
    });

    it('calculates cross-currency rate correctly for non-base currencies', async () => {
      cachingService.get.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);
      cachingService.getOrSet.mockImplementationOnce(
        async (_key: string, factory: () => Promise<number>) => factory(),
      );
      httpService.get.mockReturnValue(of({ data: { rates: { GBP: 0.79, EUR: 0.92 } } }));

      const result = await service.getExchangeRate('GBP', 'EUR');

      expect(result).toBeCloseTo(1.1646, 3);
    });
  });

  describe('getAvailableRates', () => {
    it('returns snapshot of fallback rates', () => {
      const rates = service.getAvailableRates();
      expect(rates).toHaveProperty('EUR', 0.92);
      expect(rates).toHaveProperty('GBP', 0.79);
    });
  });

  describe('refreshExchangeRates', () => {
    it('logs and returns without error', async () => {
      await expect(service.refreshExchangeRates()).resolves.toBeUndefined();
    });
  });
});
