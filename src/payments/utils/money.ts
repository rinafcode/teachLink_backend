import { ValueTransformer } from 'typeorm';
import Decimal from 'decimal.js';

/**
 * Convert an arbitrary numeric value (which may have arrived as a Number, a
 * String from SQL SUM/Postgres decimal column output, or a Decimal from an arithmetic chain)
 * into a 2-decimal currency-ready JavaScript number, using Decimal arithmetic
 * with HALF_UP rounding to avoid IEEE-754 drift.
 */
export function toMoneyNumber(value: string | number | Decimal | null | undefined): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const dec = value instanceof Decimal ? value : new Decimal(value);
  return dec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Returns a Decimal representation of the input rounded to 2 decimal places with HALF_UP rounding.
 */
export function toMoneyDecimal(value: string | number | Decimal | null | undefined): Decimal {
  if (value === null || value === undefined || value === '') {
    return new Decimal(0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }
  const dec = value instanceof Decimal ? value : new Decimal(value);
  return dec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Rounds a monetary value to the nearest cent using half-up rounding (ROUND_HALF_UP).
 */
export function roundToCents(value: string | number | Decimal | null | undefined): number {
  return toMoneyNumber(value);
}

/**
 * Adds multiple monetary values with exact decimal precision, returning the result rounded to 2 decimal places.
 */
export function add(
  a: string | number | Decimal | null | undefined,
  b: string | number | Decimal | null | undefined,
  ...rest: (string | number | Decimal | null | undefined)[]
): number {
  let dec = new Decimal(a ?? 0).plus(new Decimal(b ?? 0));
  for (const item of rest) {
    dec = dec.plus(new Decimal(item ?? 0));
  }
  return dec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Subtracts values from the initial amount with exact decimal precision, returning the result rounded to 2 decimal places.
 */
export function subtract(
  a: string | number | Decimal | null | undefined,
  b: string | number | Decimal | null | undefined,
  ...rest: (string | number | Decimal | null | undefined)[]
): number {
  let dec = new Decimal(a ?? 0).minus(new Decimal(b ?? 0));
  for (const item of rest) {
    dec = dec.minus(new Decimal(item ?? 0));
  }
  return dec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Multiplies two or more numbers with exact decimal precision, returning the result rounded to 2 decimal places.
 */
export function multiply(
  a: string | number | Decimal | null | undefined,
  b: string | number | Decimal | null | undefined,
  ...rest: (string | number | Decimal | null | undefined)[]
): number {
  let dec = new Decimal(a ?? 0).times(new Decimal(b ?? 0));
  for (const item of rest) {
    dec = dec.times(new Decimal(item ?? 0));
  }
  return dec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Divides the numerator by the denominator with exact decimal precision, returning the result rounded to 2 decimal places.
 */
export function divide(
  a: string | number | Decimal | null | undefined,
  b: string | number | Decimal | null | undefined,
): number {
  const denominator = new Decimal(b ?? 0);
  if (denominator.isZero()) {
    throw new Error('Division by zero in money calculation');
  }
  return new Decimal(a ?? 0).div(denominator).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Compares two monetary amounts at cent precision (2 decimal places).
 * Returns:
 *   0 if amounts are equal at cent level
 *   1 if a > b
 *  -1 if a < b
 */
export function compare(
  a: string | number | Decimal | null | undefined,
  b: string | number | Decimal | null | undefined,
): number {
  const decA = new Decimal(a ?? 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const decB = new Decimal(b ?? 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return decA.comparedTo(decB);
}

/**
 * Returns true if two amounts are equal at cent precision (2 decimal places).
 */
export function areAmountsEqual(
  a: string | number | Decimal | null | undefined,
  b: string | number | Decimal | null | undefined,
): boolean {
  return compare(a, b) === 0;
}

/**
 * TypeORM ValueTransformer that ensures numeric/decimal columns hydrate as JavaScript numbers
 * with fixed precision instead of raw node-postgres strings, and handles null/undefined safely.
 */
export class ColumnNumericTransformer implements ValueTransformer {
  constructor(private readonly decimalPlaces: number = 2) {}

  to(data: any): number | string | null | undefined {
    if (data === null || data === undefined) {
      return data;
    }
    if (data instanceof Decimal) {
      return data.toDecimalPlaces(this.decimalPlaces, Decimal.ROUND_HALF_UP).toNumber();
    }
    return data;
  }

  from(data: any): number | null | undefined {
    if (data === null || data === undefined) {
      return data;
    }
    return new Decimal(data).toDecimalPlaces(this.decimalPlaces, Decimal.ROUND_HALF_UP).toNumber();
  }
}

/**
 * Singleton transformer for standard 2-decimal money columns.
 */
export const columnNumericTransformer = new ColumnNumericTransformer(2);
