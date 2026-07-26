import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const originalAudience = process.env.AUTH0_AUDIENCE;

  beforeEach(() => {
    process.env.AUTH0_AUDIENCE = 'https://api.teachlink.com';
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  afterEach(() => {
    process.env.AUTH0_AUDIENCE = originalAudience;
  });

  function createContext(user: Record<string, unknown> | undefined): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user, ip: '127.0.0.1' }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
  }

  it('allows access when no roles are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    expect(guard.canActivate(createContext({ sub: 'user-1' }))).toBe(true);
  });

  it('extracts admin from Auth0 namespaced custom claims', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

    const user = {
      sub: 'auth0|6474df63a76295821df29d3c',
      'https://api.teachlink.com/roles': ['admin'],
    };

    expect(guard.canActivate(createContext(user))).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, expect.any(Array));
  });

  it('denies access when required role is missing from token', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

    const user = {
      sub: 'auth0|6474df63a76295821df29d3c',
      'https://api.teachlink.com/roles': ['student'],
    };

    expect(guard.canActivate(createContext(user))).toBe(false);
  });

  it('throws when roles are required but user is missing', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

    expect(() => guard.canActivate(createContext(undefined))).toThrow(UnauthorizedException);
  });
});
