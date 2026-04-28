import { maskEmail, maskPhone, maskName, maskFull, maskPartial } from './field-masking.util';
import { applyRoleBasedMasking, USER_MASKING_POLICIES } from './role-visibility.util';
import { UserRole } from '../../users/entities/user.entity';

describe('field-masking.util', () => {
  describe('maskEmail', () => {
    it('masks a standard email', () => {
      expect(maskEmail('john.doe@example.com')).toBe('j***e@example.com');
    });

    it('masks a short local part', () => {
      expect(maskEmail('ab@example.com')).toBe('***@example.com');
    });

    it('returns original for invalid input', () => {
      expect(maskEmail('')).toBe('');
      expect(maskEmail('notanemail')).toBe('***');
    });
  });

  describe('maskPhone', () => {
    it('keeps last 4 digits', () => {
      expect(maskPhone('1234567890')).toBe('******7890');
    });

    it('handles formatted phone numbers', () => {
      expect(maskPhone('+1 (555) 123-4567')).toBe('*******4567');
    });

    it('returns *** for very short numbers', () => {
      expect(maskPhone('123')).toBe('***');
    });
  });

  describe('maskName', () => {
    it('keeps first character', () => {
      expect(maskName('John')).toBe('J***');
    });

    it('handles single character', () => {
      expect(maskName('J')).toBe('***');
    });

    it('returns original for empty string', () => {
      expect(maskName('')).toBe('');
    });
  });

  describe('maskFull', () => {
    it('always returns [REDACTED]', () => {
      expect(maskFull('anything')).toBe('[REDACTED]');
      expect(maskFull(null)).toBe('[REDACTED]');
      expect(maskFull(123)).toBe('[REDACTED]');
    });
  });

  describe('maskPartial', () => {
    it('shows first and last 2 chars', () => {
      expect(maskPartial('abcdefgh')).toBe('ab****gh');
    });

    it('returns *** for short strings', () => {
      expect(maskPartial('ab')).toBe('***');
    });
  });
});

describe('role-visibility.util', () => {
  const userRecord = {
    id: 'uuid-1',
    email: 'john.doe@example.com',
    firstName: 'John',
    lastName: 'Doe',
    password: 'hashed-password',
    role: UserRole.STUDENT,
    refreshToken: 'some-token',
  };

  describe('applyRoleBasedMasking', () => {
    it('admin sees all fields unmasked', () => {
      const result = applyRoleBasedMasking({ ...userRecord }, UserRole.ADMIN);
      expect(result.email).toBe('john.doe@example.com');
      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe');
      // password is never visible
      expect(result.password).toBe('[REDACTED]');
    });

    it('teacher sees masked email but unmasked names', () => {
      const result = applyRoleBasedMasking({ ...userRecord }, UserRole.TEACHER);
      expect(result.email).toMatch(/\*\*\*/);
      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe');
    });

    it('student sees masked email and masked names', () => {
      const result = applyRoleBasedMasking({ ...userRecord }, UserRole.STUDENT);
      expect(result.email).toMatch(/\*\*\*/);
      expect(result.firstName).toMatch(/\*\*\*/);
      expect(result.lastName).toMatch(/\*\*\*/);
    });

    it('always redacts password regardless of role', () => {
      for (const role of Object.values(UserRole)) {
        const result = applyRoleBasedMasking({ ...userRecord }, role);
        expect(result.password).toBe('[REDACTED]');
        expect(result.refreshToken).toBe('[REDACTED]');
      }
    });

    it('leaves fields without a policy untouched', () => {
      const result = applyRoleBasedMasking({ ...userRecord }, UserRole.STUDENT);
      expect(result.id).toBe('uuid-1');
      expect(result.role).toBe(UserRole.STUDENT);
    });

    it('uses custom policies when provided', () => {
      const customPolicies = {
        firstName: {
          visibleTo: [UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT],
          mask: () => '[HIDDEN]',
        },
      };
      const result = applyRoleBasedMasking({ ...userRecord }, UserRole.STUDENT, customPolicies);
      // Student is in visibleTo, so no masking
      expect(result.firstName).toBe('John');
    });

    it('skips fields not present in the record', () => {
      const partial = { id: 'uuid-2', email: 'a@b.com' };
      const result = applyRoleBasedMasking(partial, UserRole.STUDENT, USER_MASKING_POLICIES);
      expect(result.id).toBe('uuid-2');
      expect(result.email).toMatch(/\*\*\*/);
    });
  });
});
