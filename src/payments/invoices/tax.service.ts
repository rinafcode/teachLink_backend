import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { Payment } from '../entities/payment.entity';
import { add, multiply, roundToCents } from '../utils/money';

export { roundToCents };

/**
 * Result of a tax resolution step.
 */
export interface TaxBreakdown {
  /**
   * Jurisdiction the rate was resolved from (ISO 3166-1 alpha-2 code or
   * country name), or null when no jurisdiction could be determined.
   */
  jurisdiction: string | null;
  /** Applicable tax rate as a decimal fraction (e.g. `0.2` for 20%). */
  rate: number;
  /** Tax amount rounded to the nearest cent (2 decimal places). */
  taxAmount: number;
  /** `amount + taxAmount` — the total billed to the customer. */
  totalAmount: number;
}

/**
 * Default VAT/GST/sales-tax rates keyed by ISO 3166-1 alpha-2 country code.
 *
 * Jurisdictions not listed (and jurisdictions with no consumption tax, e.g.
 * the US at the federal level) resolve to a zero rate. Rates are expressed as
 * decimal fractions so tax can be computed with decimal-safe arithmetic.
 */
const DEFAULT_TAX_RATES: Record<string, number> = {
  AE: 0.05, // UAE VAT
  AU: 0.1, // Australia GST
  BR: 0.17, // Brazil ICMS
  CA: 0.05, // Canada GST (federal)
  CH: 0.077, // Switzerland VAT (standard)
  DE: 0.19, // Germany VAT
  ES: 0.21, // Spain VAT
  FR: 0.2, // France VAT
  GB: 0.2, // United Kingdom VAT
  IE: 0.23, // Ireland VAT
  IN: 0.18, // India GST (standard)
  IT: 0.22, // Italy VAT
  JP: 0.1, // Japan consumption tax
  MX: 0.16, // Mexico VAT
  NG: 0.075, // Nigeria VAT
  NL: 0.21, // Netherlands VAT
  NZ: 0.15, // New Zealand GST
  SG: 0.09, // Singapore GST
  ZA: 0.15, // South Africa VAT
  US: 0, // No federal sales tax
};

@Injectable()
export class TaxService {
  /**
   * Returns the tax rate for a jurisdiction, defaulting to a zero rate when
   * the jurisdiction is unknown or has no consumption tax.
   */
  getRateForJurisdiction(jurisdiction: string | null | undefined): number {
    if (!jurisdiction) {
      return 0;
    }
    const code = jurisdiction.trim().toUpperCase();
    return DEFAULT_TAX_RATES[code] ?? 0;
  }

  /**
   * Resolves the customer's billing jurisdiction from the payment, preferring
   * the payment metadata (billing country/country code recorded at checkout)
   * and falling back to the user profile when available.
   */
  resolveJurisdiction(payment: Payment): string | null {
    const metadata = payment.metadata ?? {};
    const candidate =
      metadata['billingCountryCode'] ??
      metadata['billingCountry'] ??
      metadata['countryCode'] ??
      metadata['country'];

    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }

    // The user profile may carry localization fields (country/country_code)
    // depending on deployment; treat them as optional.
    const user = payment.user as
      | { countryCode?: string | null; country?: string | null }
      | null
      | undefined;

    return user?.countryCode || user?.country || null;
  }

  /**
   * Computes the tax and total for a net amount given the customer's
   * jurisdiction. `totalAmount` is `amount + taxAmount` by construction and
   * both figures are rounded to the nearest cent.
   */
  resolveTax(
    amount: number | string | Decimal,
    jurisdiction: string | null | undefined,
  ): TaxBreakdown {
    const rate = this.getRateForJurisdiction(jurisdiction);
    const taxAmount = multiply(amount, rate);
    const totalAmount = add(amount, taxAmount);

    return {
      jurisdiction: jurisdiction ?? null,
      rate,
      taxAmount,
      totalAmount,
    };
  }
}
