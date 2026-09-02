import { PricingService } from './pricing.service';
import { CurrencyService } from '../../currency/services/currency.service';
import { ExchangeRateService } from '../../currency/services/exchange-rate.service';
import { PricingDto } from '../../currency/dtos/currency.dto';

describe('PricingService', () => {
  let service: PricingService;
  let currencyService: Partial<CurrencyService>;
  let exchangeRateService: Partial<ExchangeRateService>;

  beforeEach(() => {
    currencyService = {
      convertCurrency: jest.fn().mockImplementation(async (amount, from, to) => amount * 1.2),
      formatPrice: jest.fn().mockImplementation((amount, currency) => `${currency} ${amount}`),
      roundAmount: jest.fn().mockImplementation((amount) => Math.round(amount * 100) / 100),
      getCurrencyDetails: jest.fn().mockReturnValue({ symbol: '$', code: 'USD' }),
    };

    exchangeRateService = {
      getExchangeRate: jest.fn().mockResolvedValue(1.2),
    };

    service = new PricingService(
      currencyService as CurrencyService,
      exchangeRateService as ExchangeRateService,
    );
  });

  describe('applyDiscount', () => {
    it('applies exact discount with HALF_UP rounding and without float drift', () => {
      const price: PricingDto = {
        basePrice: 19.99,
        baseCurrency: 'USD',
        localPrice: 19.99,
        localCurrency: 'USD',
        exchangeRate: 1,
        formattedPrice: '$ 19.99',
      };

      // 19.99 * 0.85 = 16.9915 -> 16.99
      const result = service.applyDiscount(price, 15);
      expect(result.localPrice).toBe(16.99);
      expect(currencyService.formatPrice).toHaveBeenCalledWith(16.99, 'USD');
    });

    it('calculates 33% discount on $29.99 accurately', () => {
      const price: PricingDto = {
        basePrice: 29.99,
        baseCurrency: 'USD',
        localPrice: 29.99,
        localCurrency: 'USD',
        exchangeRate: 1,
        formattedPrice: '$ 29.99',
      };

      // 29.99 * 0.67 = 20.0933 -> 20.09
      const result = service.applyDiscount(price, 33);
      expect(result.localPrice).toBe(20.09);
    });
  });

  describe('applyTax', () => {
    it('applies tax rate with exact HALF_UP cent rounding', () => {
      const price: PricingDto = {
        basePrice: 19.99,
        baseCurrency: 'USD',
        localPrice: 19.99,
        localCurrency: 'USD',
        exchangeRate: 1,
        formattedPrice: '$ 19.99',
      };

      // 19.99 * 1.075 = 21.48925 -> 21.49 (Nigeria VAT 7.5%)
      const result = service.applyTax(price, 7.5);
      expect(result.localPrice).toBe(21.49);
      expect(currencyService.formatPrice).toHaveBeenCalledWith(21.49, 'USD');
    });

    it('applies 19% German VAT exactly on $100', () => {
      const price: PricingDto = {
        basePrice: 100,
        baseCurrency: 'EUR',
        localPrice: 100,
        localCurrency: 'EUR',
        exchangeRate: 1,
        formattedPrice: 'EUR 100',
      };

      const result = service.applyTax(price, 19);
      expect(result.localPrice).toBe(119);
    });
  });

  describe('getLocalizedPrice', () => {
    it('rounds convertedAmount using centralized roundToCents', async () => {
      (currencyService.convertCurrency as jest.Mock).mockResolvedValue(19.995);

      const result = await service.getLocalizedPrice(10, 'EUR', 'USD');
      expect(result.convertedAmount).toBe(20);
    });
  });
});
