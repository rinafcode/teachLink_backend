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
