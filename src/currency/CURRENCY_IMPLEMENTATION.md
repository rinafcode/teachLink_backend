# Currency Conversion and Localized Pricing Implementation

## Overview

This document describes the implementation of currency conversion and localized pricing features for TeachLink. These features allow users to see prices in their local currency, enabling a more localized user experience.

## Architecture

### Modules

1. **CurrencyModule** (`src/currency/`)
   - Handles all currency-related operations
   - Provides currency detection, conversion, and formatting services
   - Exposes REST API endpoints for currency operations

2. **PaymentsModule** (`src/payments/`)
   - Integrates with currency module for localized pricing
   - Provides pricing calculations and formatting
   - Includes localized payment processing

3. **CoursesModule** (`src/courses/`)
   - Uses localized pricing service
   - Provides courses with localized pricing information

### Services

#### CurrencyService
Handles currency conversion and formatting:
- `convertCurrency(amount, fromCurrency, toCurrency)` - Convert amounts between currencies
- `formatPrice(amount, currency, locale)` - Format prices for display
- `getCurrencyDetails(currencyCode)` - Get currency symbol and name
- `roundAmount(amount, currency)` - Round to currency precision

#### ExchangeRateService
Manages exchange rates:
- Fetches rates from external API (exchangerate-api.com)
- Falls back to cached rates if API is unavailable
- Auto-refreshes rates every 24 hours
- Supports configurable API endpoints

#### CurrencyDetectionService
Detects user currency from location:
- Maps country codes to currencies
- Provides timezone-based hints
- Supports 50+ countries and their currencies
- Validates location information

#### PricingService
Handles pricing calculations:
- `getLocalizedPrice()` - Get price in user's currency
- `getPricingForPayment()` - Prepare price for payment processing
- `getMultiCurrencyPricing()` - Get pricing in multiple currencies
- `applyDiscount()` - Apply discount calculations
- `applyTax()` - Apply tax calculations

#### LocalizedCourseService
Provides localized pricing for courses:
- Get course with localized pricing
- Detect currency from user location
- Get pricing by region
- Compare prices across regions

## Database Schema Changes

### User Entity
New fields added:
- `country` (varchar, nullable) - Country name
- `countryCode` (varchar(2), nullable, indexed) - ISO country code
- `timezone` (varchar, nullable) - IANA timezone
- `city` (varchar, nullable) - City name
- `preferredCurrency` (varchar(3), default: 'USD', indexed) - Preferred currency code

### Course Entity
New fields added:
- `currency` (varchar(3), default: 'USD', indexed) - Base currency for course pricing

## API Endpoints

### Currency Endpoints

#### Convert Currency
```
POST /currency/convert
Body: {
  amount: number,
  fromCurrency: string,
  toCurrency: string
}
Response: {
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  convertedAmount: number,
  exchangeRate: number,
  timestamp: Date
}
```

#### Convert to Multiple Currencies
```
POST /currency/convert-multiple
Body: {
  amount: number,
  fromCurrency: string,
  toCurrencies?: string[]
}
Response: {
  baseAmount: number,
  baseCurrency: string,
  conversions: Record<string, number>,
  timestamp: Date
}
```

#### Get Currency Details
```
GET /currency/details/:currencyCode
Response: {
  code: string,
  symbol: string,
  name: string
}
```

#### Detect Currency
```
POST /currency/detect
Body: {
  countryCode?: string,
  country?: string,
  timezone?: string,
  ipAddress?: string
}
Response: {
  detectedCurrency: string,
  currencyDetails: CurrencyDetailsDto,
  confidence: 'high' | 'medium' | 'low',
  detectionMethod: string
}
```

#### Get Supported Currencies
```
GET /currency/supported
Response: Record<string, string> // Country code to currency mapping
```

#### Get Exchange Rates
```
GET /currency/rates
Response: Record<string, number> // Exchange rates from USD
```

#### Refresh Rates
```
POST /currency/rates/refresh
Response: { message: string, timestamp: Date }
```

### Pricing Endpoints

#### Get Localized Price
```
POST /pricing/localize
Body: {
  basePrice: number,
  baseCurrency: string,
  userCurrency: string,
  userLocale?: string
}
Response: LocalizedPriceDto
```

#### Get Payment Pricing
```
POST /pricing/for-payment
Body: {
  basePrice: number,
  baseCurrency: string,
  paymentCurrency: string
}
Response: PricingDto
```

#### Get Multi-Currency Pricing
```
POST /pricing/multi-currency
Body: {
  basePrice: number,
  baseCurrency: string,
  targetCurrencies: string[]
}
Response: Record<string, PricingDto>
```

#### Apply Discount
```
POST /pricing/apply-discount
Body: {
  pricing: PricingDto,
  discountPercent: number
}
Response: PricingDto
```

#### Apply Tax
```
POST /pricing/apply-tax
Body: {
  pricing: PricingDto,
  taxPercent: number
}
Response: PricingDto
```

## Configuration

### Environment Variables

```env
# Exchange Rate API Configuration
EXCHANGE_RATE_API_KEY=your_api_key
EXCHANGE_RATE_API_URL=https://api.exchangerate-api.com/v4/latest/USD

# I18N Configuration (existing)
I18N_DEFAULT_LOCALE=en
I18N_SUPPORTED_LOCALES=en
```

## Supported Countries and Currencies

The system supports 50+ countries with their respective currencies:

- **North America**: US (USD), CA (CAD), MX (MXN)
- **Europe**: GB (GBP), EUR countries, SE (SEK), NO (NOK), CH (CHF), etc.
- **Asia**: JP (JPY), CN (CNY), IN (INR), SG (SGD), HK (HKD), TH (THB), etc.
- **Australia/Oceania**: AU (AUD), NZ (NZD)
- **South America**: BR (BRL), AR (ARS), CL (CLP), etc.
- **Africa**: ZA (ZAR), EG (EGP), NG (NGN), KE (KES)
- **Middle East**: AE (AED), SA (SAR), IL (ILS), TR (TRY)

## Usage Examples

### Example 1: Convert USD to EUR
```typescript
const convertedAmount = await currencyService.convertCurrency(99.99, 'USD', 'EUR');
// Returns: 92.04 (approximately)
```

### Example 2: Detect User Currency from Location
```typescript
const currency = currencyDetectionService.detectCurrency({
  countryCode: 'DE',
});
// Returns: 'EUR'
```

### Example 3: Get Localized Course Pricing
```typescript
const course = await courseService.findOne(courseId);
const localizedCourse = await localizedCourseService.getLocalizedCoursePrice(
  course,
  userCurrency, // e.g., 'INR'
  userLocale, // e.g., 'en-IN'
);
// Returns: Course with price converted to INR and formatted for display
```

### Example 4: Process Payment in User's Currency
```typescript
// User in India wants to buy a $99.99 course
const pricing = await pricingService.getPricingForPayment(
  99.99,
  'USD',
  'INR', // user's currency
);
// Returns: Converted and rounded price in INR ready for payment
```

## Migration

Two migrations have been added:
1. `1685000001000-add-currency-and-location-fields-to-users.ts` - Adds location fields to users table
2. `1685000001001-add-currency-field-to-courses.ts` - Adds currency field to courses table

Run migrations with:
```bash
npm run migrate:run
```

## Exchange Rate Caching

- Exchange rates are fetched from exchangerate-api.com (free tier)
- Rates are cached in memory
- Auto-refresh occurs every 24 hours
- Fallback rates are used if API is unavailable
- Manual refresh available via `/currency/rates/refresh` endpoint

## Payment Processing Flow

1. User selects course and initiates payment
2. System detects or retrieves user's currency preference
3. Course price is converted to user's currency
4. Localized price is displayed to user
5. Upon confirmation, payment is processed in user's local currency
6. Payment record stores both base and converted amounts for reference
7. Exchange rate used for conversion is stored in payment metadata

## Error Handling

- Invalid currency codes return validation errors
- Unsupported countries default to USD
- API failures fall back to cached rates
- All prices are validated and sanitized

## Performance Considerations

- Exchange rates are cached to reduce API calls
- Currency detection is O(1) operation using hashmap
- Prices are pre-calculated and cached where possible
- All operations support bulk processing

## Security Considerations

- Exchange rates are public data with no sensitive information
- Payment amounts are always verified server-side
- Currency conversions use exact decimal precision
- All input is validated against ISO 4217 standards

## Future Enhancements

1. **Multi-Currency Pricing**: Allow instructors to set prices in multiple currencies
2. **Tax Calculation**: Implement location-based tax calculation
3. **Pricing History**: Track pricing changes over time
4. **Geo-IP Detection**: Automatic country detection from IP address
5. **Custom Exchange Rates**: Support for manual rate overrides
6. **Premium Exchange Rates**: Integration with premium exchange rate services
7. **Payment Method Localization**: Show payment methods available in each country

## References

- [ISO 4217 Currency Codes](https://en.wikipedia.org/wiki/ISO_4217)
- [ISO 3166 Country Codes](https://en.wikipedia.org/wiki/ISO_3166-1)
- [IANA Timezone Database](https://www.iana.org/time-zones)
- [ExchangeRate-API Documentation](https://exchangerate-api.com/)
