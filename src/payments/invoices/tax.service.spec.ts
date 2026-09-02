import { TaxService } from './tax.service';
import { Payment } from '../entities/payment.entity';

describe('TaxService', () => {
  let service: TaxService;

  beforeEach(() => {
    service = new TaxService();
  });

  describe('resolveJurisdiction', () => {
    it('prefers the billing country code in payment metadata', () => {
      const payment = {
        metadata: { billingCountryCode: 'DE', country: 'Germany' },
      } as unknown as Payment;

      expect(service.resolveJurisdiction(payment)).toBe('DE');
    });

    it('falls back to the country name in payment metadata', () => {
      const payment = { metadata: { billingCountry: 'Nigeria' } } as unknown as Payment;

      expect(service.resolveJurisdiction(payment)).toBe('Nigeria');
    });

    it('falls back to the user profile when metadata is absent', () => {
      const payment = {
        metadata: null,
        user: { countryCode: 'FR' },
      } as unknown as Payment;

      expect(service.resolveJurisdiction(payment)).toBe('FR');
    });

    it('returns null when no jurisdiction is available', () => {
      const payment = { metadata: {}, user: null } as unknown as Payment;

      expect(service.resolveJurisdiction(payment)).toBeNull();
    });
  });

  describe('resolveTax', () => {
    it('charges no tax for a zero-rate jurisdiction (US)', () => {
      const tax = service.resolveTax(100, 'US');

      expect(tax.rate).toBe(0);
      expect(tax.taxAmount).toBe(0);
      expect(tax.totalAmount).toBe(100);
    });

    it('charges no tax for an unknown jurisdiction', () => {
      const tax = service.resolveTax(50, 'XX');

      expect(tax.rate).toBe(0);
      expect(tax.taxAmount).toBe(0);
      expect(tax.totalAmount).toBe(50);
    });

    it('applies the standard rate for a taxable jurisdiction (DE 19%)', () => {
      const tax = service.resolveTax(100, 'DE');

      expect(tax.rate).toBe(0.19);
      expect(tax.taxAmount).toBe(19);
      expect(tax.totalAmount).toBe(119);
    });

    it('rounds tax to the nearest cent at a rounding boundary (NG 7.5% on 9.99)', () => {
      // 9.99 * 0.075 = 0.74925 → rounds to 0.75
      const tax = service.resolveTax(9.99, 'NG');

      expect(tax.rate).toBe(0.075);
      expect(tax.taxAmount).toBe(0.75);
      expect(tax.totalAmount).toBe(10.74);
    });

    it('keeps totalAmount equal to amount + taxAmount by construction', () => {
      const tax = service.resolveTax(9.99, 'DE');

      expect(tax.totalAmount).toBeCloseTo(tax.taxAmount + 9.99, 10);
      expect(tax.totalAmount).toBe(11.89);
    });

    it('records the jurisdiction on the breakdown', () => {
      const tax = service.resolveTax(25, 'GB');

      expect(tax.jurisdiction).toBe('GB');
      expect(tax.rate).toBe(0.2);
      expect(tax.taxAmount).toBe(5);
      expect(tax.totalAmount).toBe(30);
    });

    it('safely handles string input from database columns without float precision bugs', () => {
      const tax = service.resolveTax('19.99', 'NG');

      // 19.99 * 0.075 = 1.49925 -> 1.50
      expect(tax.taxAmount).toBe(1.5);
      expect(tax.totalAmount).toBe(21.49);
    });
  });
});
