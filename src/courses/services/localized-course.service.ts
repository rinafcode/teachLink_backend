import { Injectable } from '@nestjs/common';
import { CurrencyService } from '../../currency/services/currency.service';
import { CurrencyDetectionService } from '../../currency/services/currency-detection.service';
import { PricingService } from '../services/pricing.service';
import { LocalizedPriceDto } from '../../currency/dtos/currency.dto';

export interface CourseWithLocalizedPricing {
  id: string;
  title: string;
  description: string;
  instructorId: string;
  basePricing: {
    price: number;
    currency: string;
  };
  localizedPricing?: LocalizedPriceDto;
  thumbnailUrl?: string;
  status: string;
}

/**
 * Localized Course Service
 * Handles localized pricing display for courses
 */
@Injectable()
export class LocalizedCourseService {
  constructor(
    private readonly currencyService: CurrencyService,
    private readonly currencyDetectionService: CurrencyDetectionService,
    private readonly pricingService: PricingService,
  ) {}

  /**
   * Get course with localized pricing
   * @param course The course object
   * @param userCurrency The user's preferred currency
   * @param userLocale The user's locale
   * @returns Course with localized pricing
   */
  async getLocalizedCoursePrice(
    course: any,
    userCurrency: string,
    userLocale: string = 'en-US',
  ): Promise<CourseWithLocalizedPricing> {
    const baseCurrency = course.currency || 'USD';

    const localizedPricing = await this.pricingService.getLocalizedPrice(
      course.price,
      baseCurrency,
      userCurrency,
      userLocale,
    );

    return {
      id: course.id,
      title: course.title,
      description: course.description,
      instructorId: course.instructorId,
      basePricing: {
        price: course.price,
        currency: baseCurrency,
      },
      localizedPricing,
      thumbnailUrl: course.thumbnailUrl,
      status: course.status,
    };
  }

  /**
   * Get multiple courses with localized pricing
   * @param courses Array of course objects
   * @param userCurrency The user's preferred currency
   * @param userLocale The user's locale
   * @returns Array of courses with localized pricing
   */
  async getLocalizedCoursesPricing(
    courses: any[],
    userCurrency: string,
    userLocale: string = 'en-US',
  ): Promise<CourseWithLocalizedPricing[]> {
    return Promise.all(
      courses.map((course) =>
        this.getLocalizedCoursePrice(course, userCurrency, userLocale),
      ),
    );
  }

  /**
   * Detect user currency from location and get localized pricing
   * @param course The course object
   * @param userLocation User location information
   * @param userLocale User locale
   * @returns Course with localized pricing
   */
  async getLocalizedCoursePriceByLocation(
    course: any,
    userLocation: {
      countryCode?: string;
      country?: string;
      timezone?: string;
    },
    userLocale: string = 'en-US',
  ): Promise<CourseWithLocalizedPricing> {
    const userCurrency = this.currencyDetectionService.detectCurrency(
      userLocation,
    );
    return this.getLocalizedCoursePrice(course, userCurrency, userLocale);
  }

  /**
   * Get pricing for course listing
   * Returns pricing information for multiple currencies
   * @param course The course object
   * @param currencies Array of currencies
   * @returns Pricing in multiple currencies
   */
  async getMultiCurrencyCoursePricing(
    course: any,
    currencies: string[],
  ): Promise<Record<string, any>> {
    const baseCurrency = course.currency || 'USD';

    const pricingMap = await this.pricingService.getMultiCurrencyPricing(
      course.price,
      baseCurrency,
      currencies,
    );

    return {
      courseId: course.id,
      title: course.title,
      basePricing: {
        price: course.price,
        currency: baseCurrency,
      },
      currencyOptions: pricingMap,
    };
  }

  /**
   * Get comparable pricing across regions
   * @param course The course object
   * @param regions Array of country codes
   * @returns Pricing for each region
   */
  async getPricingByRegion(
    course: any,
    regions: string[],
  ): Promise<Record<string, any>> {
    const baseCurrency = course.currency || 'USD';
    const regionalCurrencies: Record<string, string> = {};

    // Map regions to currencies
    for (const region of regions) {
      const currency =
        this.currencyDetectionService.getSupportedCountries()[region];
      if (currency) {
        regionalCurrencies[region] = currency;
      }
    }

    const pricingByRegion: Record<string, any> = {};

    for (const [region, currency] of Object.entries(regionalCurrencies)) {
      const pricing = await this.pricingService.getPricingForPayment(
        course.price,
        baseCurrency,
        currency,
      );

      pricingByRegion[region] = {
        countryCode: region,
        currency,
        ...pricing,
      };
    }

    return {
      courseId: course.id,
      title: course.title,
      basePricing: {
        price: course.price,
        currency: baseCurrency,
      },
      regionalPricing: pricingByRegion,
    };
  }
}
