import { User, UserRole } from './user.entity';

describe('User entity - role getter', () => {
  it('should throw when roles relation is not loaded (undefined)', () => {
    const user = new User();
    expect(() => user.role).toThrow(
      'User.roles relation not loaded. Include relations: ["roles"] in the query.',
    );
  });

  it('should return the first role name when roles are loaded with values', () => {
    const user = new User();
    (user as any).roles = [{ name: 'teacher' }, { name: 'moderator' }];
    expect(user.role).toBe(UserRole.TEACHER);
  });

  it('should return STUDENT when roles array is loaded but empty', () => {
    const user = new User();
    (user as any).roles = [];
    expect(user.role).toBe(UserRole.STUDENT);
  });

  it('should throw when roles is explicitly set to undefined', () => {
    const user = new User();
    (user as any).roles = undefined;
    expect(() => user.role).toThrow(
      'User.roles relation not loaded. Include relations: ["roles"] in the query.',
    );
  });

  it('should not throw when roles is null (edge case)', () => {
    const user = new User();
    (user as any).roles = null;
    expect(user.role).toBe(UserRole.STUDENT);
  });
});

describe('User entity - hasRole', () => {
  it('should throw when roles relation is not loaded', () => {
    const user = new User();
    expect(() => user.hasRole(UserRole.ADMIN)).toThrow(
      'User.roles relation not loaded. Include relations: ["roles"] in the query.',
    );
  });

  it('should return true when a hydrated entity role matches', () => {
    const user = new User();
    (user as any).roles = [{ name: 'admin' }, { name: 'moderator' }];
    expect(user.hasRole(UserRole.ADMIN)).toBe(true);
    expect(user.hasRole(UserRole.MODERATOR)).toBe(true);
  });

  it('should return true when a plain string role matches', () => {
    const user = new User();
    (user as any).roles = ['admin', 'moderator'];
    expect(user.hasRole(UserRole.ADMIN)).toBe(true);
    expect(user.hasRole(UserRole.MODERATOR)).toBe(true);
  });

  it('should return false when no role matches', () => {
    const user = new User();
    (user as any).roles = [{ name: 'student' }];
    expect(user.hasRole(UserRole.ADMIN)).toBe(false);
    expect(user.hasRole(UserRole.MODERATOR)).toBe(false);
  });

  it('should return false for an empty roles array', () => {
    const user = new User();
    (user as any).roles = [];
    expect(user.hasRole(UserRole.ADMIN)).toBe(false);
  });

  it('should match any of multiple target roles', () => {
    const user = new User();
    (user as any).roles = [{ name: 'moderator' }];
    expect(user.hasRole(UserRole.ADMIN, UserRole.MODERATOR)).toBe(true);
  });

  it('should handle mixed string and entity roles in the same array', () => {
    const user = new User();
    (user as any).roles = ['student', { name: 'admin' }];
    expect(user.hasRole(UserRole.ADMIN)).toBe(true);
  });
});
