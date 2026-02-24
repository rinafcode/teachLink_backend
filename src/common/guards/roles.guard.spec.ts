import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: any;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    };
    guard = new RolesGuard(reflector);
  });

  it('should allow access if no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({ getRequest: () => ({ user: { roles: ['admin'] } }) }),
    };
    expect(guard.canActivate(context as any)).toBe(true);
  });

  it('should deny access if user has no roles', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    const context = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({ getRequest: () => ({ user: {} }) }),
    };
    expect(guard.canActivate(context as any)).toBe(false);
  });

  it('should allow access if user has required role', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    const context = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({ getRequest: () => ({ user: { roles: ['admin', 'moderator'] } }) }),
    };
    expect(guard.canActivate(context as any)).toBe(true);
  });

  it('should deny access if user does not have required role', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    const context = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({ getRequest: () => ({ user: { roles: ['user'] } }) }),
    };
    expect(guard.canActivate(context as any)).toBe(false);
  });

  it('should support multiple roles per endpoint', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin', 'moderator']);
    const context = {
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({ getRequest: () => ({ user: { roles: ['moderator'] } }) }),
    };
    expect(guard.canActivate(context as any)).toBe(true);
  });
});
