import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface LocationToCurrencyMap {
  [countryCode: string]: string;
}

interface UserLocation {
  country?: string;
  countryCode?: string;
  timezone?: string;
  city?: string;
}

/**
 * Currency Detection Service
 * Detects user location and maps it to appropriate currency
 */
@Injectable()
export class CurrencyDetectionService {
  private readonly logger = new Logger(CurrencyDetectionService.name);

  // Comprehensive country code to currency mapping
  private readonly countryToCurrencyMap: LocationToCurrencyMap = {
    // North America
    US: 'USD',
    CA: 'CAD',
    MX: 'MXN',
    // Europe
    GB: 'GBP',
    DE: 'EUR',
    FR: 'EUR',
    IT: 'EUR',
    ES: 'EUR',
    NL: 'EUR',
    BE: 'EUR',
    AT: 'EUR',
    IE: 'EUR',
    PT: 'EUR',
    CZ: 'EUR',
    SE: 'SEK',
    NO: 'NOK',
    DK: 'DKK',
    PL: 'PLN',
    CH: 'CHF',
    // Asia
    JP: 'JPY',
    CN: 'CNY',
    IN: 'INR',
    SG: 'SGD',
    HK: 'HKD',
    TH: 'THB',
    MY: 'MYR',
    PH: 'PHP',
    ID: 'IDR',
    VN: 'VND',
    KR: 'KRW',
    TW: 'TWD',
    // Australia & Oceania
    AU: 'AUD',
    NZ: 'NZD',
    // South America
    BR: 'BRL',
    AR: 'ARS',
    CL: 'CLP',
    CO: 'COP',
    PE: 'PEN',
    // Africa
    ZA: 'ZAR',
    EG: 'EGP',
    NG: 'NGN',
    KE: 'KES',
    // Middle East
    AE: 'AED',
    SA: 'SAR',
    IL: 'ILS',
    TR: 'TRY',
    // Turkey (transcontinental but often grouped with Middle East)
    RU: 'RUB', // Russia
    UA: 'UAH', // Ukraine
  };

  // Timezone to currency hints (used as fallback)
  private readonly timezoneHints: { [timezone: string]: string } = {
    'America/New_York': 'USD',
    'America/Chicago': 'USD',
    'America/Denver': 'USD',
    'America/Los_Angeles': 'USD',
    'America/Anchorage': 'USD',
    'America/Toronto': 'CAD',
    'America/Mexico_City': 'MXN',
    'Europe/London': 'GBP',
    'Europe/Paris': 'EUR',
    'Europe/Berlin': 'EUR',
    'Europe/Madrid': 'EUR',
    'Europe/Rome': 'EUR',
    'Europe/Amsterdam': 'EUR',
    'Europe/Stockholm': 'SEK',
    'Europe/Oslo': 'NOK',
    'Asia/Tokyo': 'JPY',
    'Asia/Shanghai': 'CNY',
    'Asia/Hong_Kong': 'HKD',
    'Asia/Singapore': 'SGD',
    'Asia/Bangkok': 'THB',
    'Australia/Sydney': 'AUD',
    'Pacific/Auckland': 'NZD',
    'America/Sao_Paulo': 'BRL',
    'Africa/Johannesburg': 'ZAR',
    'Asia/Kolkata': 'INR',
  };

  constructor(private readonly configService: ConfigService) {}

  /**
   * Detect currency from user location
   * @param location User location object
   * @returns Currency code or default USD
   */
  detectCurrency(location: UserLocation): string {
    // Priority 1: Country code
    if (location.countryCode) {
      const currency = this.countryToCurrencyMap[location.countryCode];
      if (currency) {
        return currency;
      }
    }

    // Priority 2: Country name
    if (location.country) {
      const countryCode = this.getCountryCodeFromName(location.country);
      const currency = this.countryToCurrencyMap[countryCode];
      if (currency) {
        return currency;
      }
    }

    // Priority 3: Timezone
    if (location.timezone) {
      const currency = this.timezoneHints[location.timezone];
      if (currency) {
        return currency;
      }
    }

    // Default to USD
    return 'USD';
  }

  /**
   * Detect currency from IP address
   * @param ipAddress User IP address
   * @returns Currency code or default USD
   */
  async detectCurrencyFromIP(ipAddress: string): Promise<string> {
    try {
      // In production, you could use services like:
      // - MaxMind GeoIP2
      // - IP2Location
      // - IPStack
      // For now, we'll return USD as default
      // Implementation would call external geolocation service

      this.logger.debug(`Detecting currency for IP: ${ipAddress}`);
      // Placeholder: Would call geolocation service here
      return 'USD';
    } catch (error) {
      this.logger.error(`Error detecting currency from IP: ${error}`);
      return 'USD';
    }
  }

  /**
   * Get all supported countries and their currencies
   * @returns Map of country codes to currencies
   */
  getSupportedCountries(): LocationToCurrencyMap {
    return { ...this.countryToCurrencyMap };
  }

  /**
   * Get country code from country name
   * @param countryName Country name
   * @returns Country code
   */
  private getCountryCodeFromName(countryName: string): string {
    const countryNameToCode: { [name: string]: string } = {
      'united states': 'US',
      'united states of america': 'US',
      'united kingdom': 'GB',
      'england': 'GB',
      canada: 'CA',
      mexico: 'MX',
      germany: 'DE',
      france: 'FR',
      italy: 'IT',
      spain: 'ES',
      japan: 'JP',
      china: 'CN',
      india: 'IN',
      singapore: 'SG',
      'hong kong': 'HK',
      australia: 'AU',
      'new zealand': 'NZ',
      brazil: 'BR',
      'south africa': 'ZA',
      'south korea': 'KR',
      korea: 'KR',
      thailand: 'TH',
      vietnam: 'VN',
      philippines: 'PH',
      netherlands: 'NL',
      switzerland: 'CH',
      sweden: 'SE',
      norway: 'NO',
      denmark: 'DK',
      austria: 'AT',
      belgium: 'BE',
      portugal: 'PT',
      'czech republic': 'CZ',
      czechia: 'CZ',
      poland: 'PL',
      turkey: 'TR',
      russia: 'RU',
      ukraine: 'UA',
      uae: 'AE',
      'united arab emirates': 'AE',
      'saudi arabia': 'SA',
      israel: 'IL',
      indonesia: 'ID',
      malaysia: 'MY',
      chile: 'CL',
      colombia: 'CO',
      peru: 'PE',
      argentina: 'AR',
      egypt: 'EG',
      nigeria: 'NG',
      kenya: 'KE',
      ireland: 'IE',
      taiwan: 'TW',
    };

    const key = countryName.toLowerCase().trim();
    return countryNameToCode[key] || 'US';
  }

  /**
   * Validate if location is supported
   * @param location User location
   * @returns True if location can be mapped to currency
   */
  isSupportedLocation(location: UserLocation): boolean {
    if (
      location.countryCode &&
      this.countryToCurrencyMap[location.countryCode]
    ) {
      return true;
    }

    if (location.country) {
      const countryCode = this.getCountryCodeFromName(location.country);
      if (this.countryToCurrencyMap[countryCode]) {
        return true;
      }
    }

    if (location.timezone && this.timezoneHints[location.timezone]) {
      return true;
    }

    return false;
  }
}
