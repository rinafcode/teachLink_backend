import { Test, TestingModule } from '@nestjs/testing';
import { DataAnonymizationService, IAnonymizationOptions } from './data-anonymization.service';

describe('DataAnonymizationService', () => {
  let service: DataAnonymizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DataAnonymizationService],
    }).compile();

    service = module.get<DataAnonymizationService>(DataAnonymizationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // anonymizeUserData
  // ---------------------------------------------------------------------------
  describe('anonymizeUserData', () => {
    it('should anonymize default PII fields with default options', () => {
      const input = {
        id: 'user-123',
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '555-1234',
        address: '123 Main St',
        role: 'student',
      };

      const result = service.anonymizeUserData(input);

      // id should be hashed when hashIdentifiers is true (default)
      expect(result.id).toMatch(/^hash_/);

      // email should keep the domain by default
      expect(result.email).toMatch(/@example\.com$/);
      expect(result.email).not.toContain('john');

      // firstName, lastName, phone, address should be partially masked
      expect(result.firstName).toMatch(/^J\*+$/);
      expect(result.lastName).toMatch(/^D\*+$/);
      expect(result.phone).toMatch(/^5\*+$/);
      expect(result.address).toMatch(/^1\*+$/);

      // Non-PII fields must be untouched
      expect(result.role).toBe('student');
    });

    it('should not mutate the original data object', () => {
      const input = { id: 'abc', email: 'test@test.com', name: 'Alice' };
      const copy = { ...input };

      service.anonymizeUserData(input);

      expect(input).toEqual(copy);
    });

    it('should anonymize email without keeping domain when keepEmailDomain is false', () => {
      const input = { email: 'user@domain.com' };
      const options: IAnonymizationOptions = { keepEmailDomain: false };

      const result = service.anonymizeUserData(input, options);

      expect(result.email).toMatch(/^hash_/);
      expect(result.email).not.toContain('@');
    });

    it('should NOT hash id when hashIdentifiers is false', () => {
      const input = { id: 'user-999', email: 'a@b.com' };
      const options: IAnonymizationOptions = { hashIdentifiers: false };

      const result = service.anonymizeUserData(input, options);

      expect(result.id).toBe('user-999');
    });

    it('should anonymize only specified fields when fieldsToAnonymize is provided', () => {
      const input = {
        email: 'test@example.com',
        firstName: 'Alice',
        secret: 'my-secret',
      };
      const options: IAnonymizationOptions = { fieldsToAnonymize: ['secret'] };

      const result = service.anonymizeUserData(input, options);

      // Only 'secret' should be masked
      expect(result.secret).toMatch(/^m\*+$/);
      // email and firstName are NOT in fieldsToAnonymize, so they are unchanged
      expect(result.email).toBe('test@example.com');
      expect(result.firstName).toBe('Alice');
    });

    it('should handle data with no PII fields gracefully', () => {
      const input = { role: 'admin', createdAt: '2024-01-01' };

      const result = service.anonymizeUserData(input);

      expect(result).toEqual({ role: 'admin', createdAt: '2024-01-01' });
    });

    it('should handle an empty object without throwing', () => {
      expect(() => service.anonymizeUserData({})).not.toThrow();
      expect(service.anonymizeUserData({})).toEqual({});
    });

    it('should handle a field with a 1-character value', () => {
      const input = { firstName: 'A' };

      const result = service.anonymizeUserData(input);

      // length <= 2 → all stars
      expect(result.firstName).toBe('*');
    });

    it('should handle a field with a 2-character value', () => {
      const input = { firstName: 'Jo' };

      const result = service.anonymizeUserData(input);

      expect(result.firstName).toBe('**');
    });

    it('should hash the id even when id is a numeric string', () => {
      const input = { id: '42' };

      const result = service.anonymizeUserData(input);

      expect(result.id).toMatch(/^hash_/);
    });

    it('should treat an email without a domain as a hash', () => {
      const input = { email: 'nodomain' };

      const result = service.anonymizeUserData(input);

      // anonymizeEmail falls back to hashValue when there is no "@" separator
      expect(result.email).toMatch(/^hash_/);
    });

    it('should handle email with a single-character local part', () => {
      const input = { email: 'a@example.com' };

      const result = service.anonymizeUserData(input);

      // username length === 1 → '*'
      expect(result.email).toBe('*@example.com');
    });
  });

  // ---------------------------------------------------------------------------
  // anonymizeRecords
  // ---------------------------------------------------------------------------
  describe('anonymizeRecords', () => {
    it('should anonymize each record in the array', () => {
      const records = [
        { id: '1', email: 'alice@test.com', firstName: 'Alice' },
        { id: '2', email: 'bob@test.com', firstName: 'Bob' },
      ];

      const results = service.anonymizeRecords(records);

      expect(results).toHaveLength(2);
      results.forEach((r) => {
        expect(r.id).toMatch(/^hash_/);
        expect(r.email).toMatch(/@test\.com$/);
      });
    });

    it('should return an empty array when given an empty array', () => {
      expect(service.anonymizeRecords([])).toEqual([]);
    });

    it('should pass options down to each record', () => {
      const records = [{ email: 'x@y.com' }, { email: 'a@b.org' }];
      const options: IAnonymizationOptions = { keepEmailDomain: false };

      const results = service.anonymizeRecords(records, options);

      results.forEach((r) => {
        expect(r.email).toMatch(/^hash_/);
      });
    });

    it('should not mutate the original records', () => {
      const records = [{ id: 'orig', email: 'orig@domain.com' }];
      const original = JSON.parse(JSON.stringify(records));

      service.anonymizeRecords(records);

      expect(records).toEqual(original);
    });
  });

  // ---------------------------------------------------------------------------
  // containsPII
  // ---------------------------------------------------------------------------
  describe('containsPII', () => {
    it('should return true when a known PII field is present and non-null', () => {
      expect(service.containsPII({ email: 'user@example.com' })).toBe(true);
      expect(service.containsPII({ firstName: 'Bob' })).toBe(true);
      expect(service.containsPII({ phone: '123' })).toBe(true);
      expect(service.containsPII({ ssn: '000-00-0000' })).toBe(true);
      expect(service.containsPII({ dateOfBirth: '1990-01-01' })).toBe(true);
      expect(service.containsPII({ creditCard: '4111111111111111' })).toBe(true);
    });

    it('should return false when no PII field is present', () => {
      expect(service.containsPII({ role: 'admin', score: 99 })).toBe(false);
    });

    it('should return false when PII field exists but is null', () => {
      expect(service.containsPII({ email: null })).toBe(false);
    });

    it('should return false when PII field exists but is undefined', () => {
      expect(service.containsPII({ email: undefined })).toBe(false);
    });

    it('should return false for an empty object', () => {
      expect(service.containsPII({})).toBe(false);
    });

    it('should return true when multiple PII fields are present', () => {
      expect(
        service.containsPII({ email: 'a@b.com', firstName: 'X', role: 'user' }),
      ).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // removePII
  // ---------------------------------------------------------------------------
  describe('removePII', () => {
    it('should remove all default PII fields', () => {
      const input = {
        id: '1',
        email: 'test@test.com',
        firstName: 'Test',
        lastName: 'User',
        phone: '000',
        address: 'Nowhere',
        ssn: '123',
        dateOfBirth: '2000-01-01',
        creditCard: '4111',
        role: 'student',
      };

      const result = service.removePII(input);

      expect(result).not.toHaveProperty('email');
      expect(result).not.toHaveProperty('firstName');
      expect(result).not.toHaveProperty('lastName');
      expect(result).not.toHaveProperty('phone');
      expect(result).not.toHaveProperty('address');
      expect(result).not.toHaveProperty('ssn');
      expect(result).not.toHaveProperty('dateOfBirth');
      expect(result).not.toHaveProperty('creditCard');

      // Non-PII fields should survive
      expect(result.id).toBe('1');
      expect(result.role).toBe('student');
    });

    it('should remove only the explicitly specified fields', () => {
      const input = { email: 'a@b.com', firstName: 'Alice', role: 'admin' };

      const result = service.removePII(input, ['email']);

      expect(result).not.toHaveProperty('email');
      expect(result.firstName).toBe('Alice');
      expect(result.role).toBe('admin');
    });

    it('should not mutate the original object', () => {
      const input = { email: 'keep@me.com', role: 'user' };

      service.removePII(input);

      expect(input.email).toBe('keep@me.com');
    });

    it('should handle an empty fieldsToRemove array without removing anything', () => {
      const input = { email: 'a@b.com', role: 'user' };

      const result = service.removePII(input, []);

      expect(result).toEqual(input);
    });

    it('should return the same data when no PII fields are present', () => {
      const input = { role: 'admin', score: 100 };

      const result = service.removePII(input);

      expect(result).toEqual(input);
    });

    it('should handle an empty object gracefully', () => {
      expect(service.removePII({})).toEqual({});
    });

    it('should silently skip fields that do not exist in the data', () => {
      const input = { role: 'user' };

      expect(() => service.removePII(input, ['email', 'phone'])).not.toThrow();
      expect(service.removePII(input, ['email', 'phone'])).toEqual({ role: 'user' });
    });
  });
});
