import { ConfigService } from '@nestjs/config';
import { CurrencyDetectionService } from './currency-detection.service';

describe('CurrencyDetectionService', () => {
  const service = new CurrencyDetectionService({} as ConfigService);

  it('detects currency from country code and country name', () => {
    expect(service.detectCurrency({ countryCode: 'CA' })).toBe('CAD');
    expect(service.detectCurrency({ country: 'United Kingdom' })).toBe('GBP');
  });

  it('falls back to timezone and USD', () => {
    expect(service.detectCurrency({ timezone: 'Asia/Tokyo' })).toBe('JPY');
    expect(service.detectCurrency({})).toBe('USD');
  });

  it('returns USD for IP-based detection in the current implementation', async () => {
    await expect(service.detectCurrencyFromIP('203.0.113.10')).resolves.toBe('USD');
  });

  it('exposes a copy of supported countries', () => {
    const countries = service.getSupportedCountries();
    expect(countries).toHaveProperty('US', 'USD');
    countries.US = 'XXX';
    expect(service.getSupportedCountries().US).toBe('USD');
  });
});
