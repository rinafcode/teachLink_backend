import Decimal from 'decimal.js';
import {
  toMoneyNumber,
  toMoneyDecimal,
  roundToCents,
  add,
  subtract,
  multiply,
  divide,
  compare,
  areAmountsEqual,
  ColumnNumericTransformer,
  columnNumericTransformer,
} from './money';

describe('Money Utility', () => {
  describe('toMoneyNumber', () => {
    it('formats a float with IEEE-754 drift to exact 2-decimal number', () => {
      expect(toMoneyNumber(0.1 + 0.2)).toBe(0.3);
    });

    it('rounds half-up at decimal boundaries', () => {
      expect(toMoneyNumber(19.995)).toBe(20);
      expect(toMoneyNumber(19.994)).toBe(19.99);
      expect(toMoneyNumber(1.005)).toBe(1.01);
      expect(toMoneyNumber(1.004)).toBe(1);
    });

    it('converts Postgres decimal driver string to number', () => {
      expect(toMoneyNumber('49.99')).toBe(49.99);
      expect(toMoneyNumber('0.00')).toBe(0);
      expect(toMoneyNumber('123.456')).toBe(123.46);
    });

    it('converts Decimal instances to number', () => {
      const dec = new Decimal('29.99');
      expect(toMoneyNumber(dec)).toBe(29.99);
    });

    it('handles null, undefined, and empty string gracefully', () => {
      expect(toMoneyNumber(null)).toBe(0);
      expect(toMoneyNumber(undefined)).toBe(0);
      expect(toMoneyNumber('')).toBe(0);
    });

    it('handles negative monetary amounts', () => {
      expect(toMoneyNumber(-10.555)).toBe(-10.56);
      expect(toMoneyNumber('-10.554')).toBe(-10.55);
    });
  });

  describe('toMoneyDecimal', () => {
    it('returns a Decimal instance with 2 decimal places', () => {
      const dec = toMoneyDecimal('19.995');
      expect(dec).toBeInstanceOf(Decimal);
      expect(dec.toString()).toBe('20');
      expect(dec.toNumber()).toBe(20);
    });

    it('handles null/undefined gracefully', () => {
      const dec = toMoneyDecimal(null);
      expect(dec.toNumber()).toBe(0);
    });
  });

  describe('roundToCents', () => {
    it('rounds values to nearest cent using ROUND_HALF_UP', () => {
      expect(roundToCents(9.991)).toBe(9.99);
      expect(roundToCents(9.995)).toBe(10);
      expect(roundToCents('14.996')).toBe(15);
    });
  });

  describe('add', () => {
    it('sums numbers without floating-point accumulation errors', () => {
      expect(add(0.1, 0.2)).toBe(0.3);
      expect(add('19.99', 5, '0.01')).toBe(25);
      expect(add('10.25', '20.75', '5.50')).toBe(36.5);
    });

    it('handles null and undefined operands as zero', () => {
      expect(add(10, null, undefined, 5)).toBe(15);
    });
  });

  describe('subtract', () => {
    it('subtracts numbers with exact decimal precision', () => {
      expect(subtract(0.3, 0.1)).toBe(0.2);
      expect(subtract('100.00', '25.50', '14.50')).toBe(60);
      expect(subtract(50, 60)).toBe(-10);
    });

    it('handles null and undefined operands as zero', () => {
      expect(subtract(100, null, 25)).toBe(75);
    });
  });

  describe('multiply', () => {
    it('multiplies numbers exactly and rounds to cents', () => {
      // 19.99 * 0.85 = 16.9915 -> 16.99
      expect(multiply(19.99, 0.85)).toBe(16.99);
      // 19.99 * 1.075 = 21.48925 -> 21.49
      expect(multiply(19.99, 1.075)).toBe(21.49);
      expect(multiply('10.00', 3)).toBe(30);
    });

    it('handles multi-argument multiplication', () => {
      expect(multiply(10, 2, 1.5)).toBe(30);
    });
  });

  describe('divide', () => {
    it('divides numbers with exact decimal precision and cent rounding', () => {
      expect(divide(10, 3)).toBe(3.33);
      expect(divide(100, 4)).toBe(25);
      expect(divide('19.99', 4)).toBe(5); // 4.9975 -> 5.00
    });

    it('throws when dividing by zero', () => {
      expect(() => divide(100, 0)).toThrow('Division by zero in money calculation');
      expect(() => divide(100, '0')).toThrow('Division by zero in money calculation');
    });
  });

  describe('compare and areAmountsEqual', () => {
    it('considers amounts equal when they match to the cent despite float drift', () => {
      const a = 19.99;
      const b = 19.990000000000002;
      expect(areAmountsEqual(a, b)).toBe(true);
      expect(compare(a, b)).toBe(0);
    });

    it('detects real cent differences', () => {
      expect(areAmountsEqual(19.99, 19.98)).toBe(false);
      expect(compare(19.99, 19.98)).toBe(1);
      expect(compare(19.98, 19.99)).toBe(-1);
    });

    it('compares string and number representations accurately', () => {
      expect(areAmountsEqual('100.00', 100)).toBe(true);
      expect(areAmountsEqual('100.005', '100.01')).toBe(true); // 100.005 rounds to 100.01
      expect(areAmountsEqual('100.004', '100.00')).toBe(true);
    });
  });

  describe('ColumnNumericTransformer', () => {
    it('deserializes string driver values into numbers', () => {
      expect(columnNumericTransformer.from('19.99')).toBe(19.99);
      expect(columnNumericTransformer.from('0.00')).toBe(0);
      expect(columnNumericTransformer.from(19.99)).toBe(19.99);
    });

    it('passes through null and undefined on deserialization', () => {
      expect(columnNumericTransformer.from(null)).toBeNull();
      expect(columnNumericTransformer.from(undefined)).toBeUndefined();
    });

    it('serializes numbers and Decimals properly for database storage', () => {
      expect(columnNumericTransformer.to(19.99)).toBe(19.99);
      expect(columnNumericTransformer.to(new Decimal('19.99'))).toBe(19.99);
      expect(columnNumericTransformer.to(null)).toBeNull();
      expect(columnNumericTransformer.to(undefined)).toBeUndefined();
    });

    it('supports custom decimal precision for rates', () => {
      const rateTransformer = new ColumnNumericTransformer(4);
      expect(rateTransformer.from('0.0750')).toBe(0.075);
      expect(rateTransformer.from('0.0775')).toBe(0.0775);
      expect(rateTransformer.to(new Decimal('0.0775'))).toBe(0.0775);
    });
  });
});
