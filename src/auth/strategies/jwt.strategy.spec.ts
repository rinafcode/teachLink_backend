import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('Auth0 JwtStrategy (strategies/jwt.strategy)', () => {
  const originalAudience = process.env.AUTH0_AUDIENCE;
  const originalIssuer = process.env.AUTH0_ISSUER_URL;

  beforeEach(() => {
    process.env.AUTH0_AUDIENCE = 'https://api.teachlink.com';
    process.env.AUTH0_ISSUER_URL = 'https://dev-teachlink.us.auth0.com/';
  });

  afterEach(() => {
    process.env.AUTH0_AUDIENCE = originalAudience;
    process.env.AUTH0_ISSUER_URL = originalIssuer;
  });

  it('instantiates when Auth0 env vars are set', () => {
    expect(() => new JwtStrategy()).not.toThrow();
  });

  it('returns the decoded payload from validate()', async () => {
    const strategy = new JwtStrategy();
    const mockPayload = {
      sub: 'auth0|6474df63a76295821df29d3c',
      email: 'security.engineer@teachlink.com',
      'https://api.teachlink.com/roles': ['admin'],
    };

    await expect(strategy.validate(mockPayload)).resolves.toEqual(mockPayload);
  });

  it('throws UnauthorizedException when payload is empty', async () => {
    const strategy = new JwtStrategy();

    await expect(strategy.validate(null)).rejects.toThrow(UnauthorizedException);
  });
});
