import { Test, TestingModule } from '@nestjs/testing';

import { CurrencyDetectionService } from '../../currency/services/currency-detection.service';
import { CurrencyService } from '../../currency/services/currency.service';
import { PricingService } from '../../payments/services/pricing.service';
import { LocalizedCourseService } from './localized-course.service';

describe('LocalizedCourseService', () => {
  let service: LocalizedCourseService;

  const pricingService = {
    getLocalizedPrice: jest.fn(),
    getMultiCurrencyPricing: jest.fn(),
    getPricingForPayment: jest.fn(),
  };

  const currencyDetectionService = {
    detectCurrency: jest.fn(),
    getSupportedCountries: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalizedCourseService,
        { provide: CurrencyService, useValue: {} },
        { provide: CurrencyDetectionService, useValue: currencyDetectionService },
        { provide: PricingService, useValue: pricingService },
      ],
    }).compile();

    service = module.get(LocalizedCourseService);
    jest.clearAllMocks();
  });

  it('getLocalizedCoursePrice uses the default base currency when the course does not define one', async () => {
    pricingService.getLocalizedPrice.mockResolvedValue({ targetCurrency: 'NGN' });

    const result = await service.getLocalizedCoursePrice(
      {
        id: 'course-1',
        title: 'Course',
        description: 'Description',
        instructorId: 'instr-1',
        price: 50,
        status: 'published',
      },
      'NGN',
    );

    expect(pricingService.getLocalizedPrice).toHaveBeenCalledWith(50, 'USD', 'NGN', 'en-US');
    expect(result.basePricing).toEqual({ price: 50, currency: 'USD' });
  });

  it('getLocalizedCoursesPricing maps each course through localized pricing', async () => {
    pricingService.getLocalizedPrice.mockResolvedValue({ targetCurrency: 'USD' });

    const result = await service.getLocalizedCoursesPricing(
      [
        {
          id: 'course-1',
          title: 'Course 1',
          description: 'Description 1',
          instructorId: 'instr-1',
          price: 50,
          currency: 'EUR',
          status: 'published',
        },
        {
          id: 'course-2',
          title: 'Course 2',
          description: 'Description 2',
          instructorId: 'instr-2',
          price: 75,
          currency: 'GBP',
          status: 'published',
        },
      ],
      'USD',
    );

    expect(result).toHaveLength(2);
    expect(pricingService.getLocalizedPrice).toHaveBeenCalledTimes(2);
  });

  it('getLocalizedCoursePriceByLocation resolves the currency from location', async () => {
    currencyDetectionService.detectCurrency.mockReturnValue('NGN');
    pricingService.getLocalizedPrice.mockResolvedValue({ targetCurrency: 'NGN' });

    const course = {
      id: 'course-1',
      title: 'Course',
      description: 'Description',
      instructorId: 'instr-1',
      price: 50,
      currency: 'USD',
      status: 'published',
    };

    await service.getLocalizedCoursePriceByLocation(course, { countryCode: 'NG' }, 'en-NG');

    expect(currencyDetectionService.detectCurrency).toHaveBeenCalledWith({ countryCode: 'NG' });
    expect(pricingService.getLocalizedPrice).toHaveBeenCalledWith(50, 'USD', 'NGN', 'en-NG');
  });

  it('getMultiCurrencyCoursePricing returns pricing options for the requested currencies', async () => {
    pricingService.getMultiCurrencyPricing.mockResolvedValue({
      USD: { localCurrency: 'USD' },
      NGN: { localCurrency: 'NGN' },
    });

    const result = await service.getMultiCurrencyCoursePricing(
      {
        id: 'course-1',
        title: 'Course',
        description: 'Description',
        instructorId: 'instr-1',
        price: 50,
        currency: 'EUR',
        status: 'published',
      },
      ['USD', 'NGN'],
    );

    expect(pricingService.getMultiCurrencyPricing).toHaveBeenCalledWith(50, 'EUR', ['USD', 'NGN']);
    expect(result.currencyOptions).toEqual({
      USD: { localCurrency: 'USD' },
      NGN: { localCurrency: 'NGN' },
    });
  });

  it('getPricingByRegion skips unsupported regions and returns supported pricing', async () => {
    currencyDetectionService.getSupportedCountries.mockReturnValue({
      NG: 'NGN',
      US: 'USD',
    });
    pricingService.getPricingForPayment
      .mockResolvedValueOnce({ localCurrency: 'NGN', localPrice: 100 })
      .mockResolvedValueOnce({ localCurrency: 'USD', localPrice: 75 });

    const result = await service.getPricingByRegion(
      {
        id: 'course-1',
        title: 'Course',
        description: 'Description',
        instructorId: 'instr-1',
        price: 50,
        currency: 'EUR',
        status: 'published',
      },
      ['NG', 'XX', 'US'],
    );

    expect(pricingService.getPricingForPayment).toHaveBeenCalledTimes(2);
    expect(result.regionalPricing.NG.currency).toBe('NGN');
    expect(result.regionalPricing.US.currency).toBe('USD');
    expect(result.regionalPricing.XX).toBeUndefined();
  });
});
