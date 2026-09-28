import { ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { WsJwtAuthGuard } from './ws-jwt-auth.guard';

const makeClient = (overrides: Record<string, unknown> = {}) => ({
  id: 'socket-123',
  handshake: { auth: {}, query: {}, ...overrides },
  data: {} as Record<string, unknown>,
});

const makeContext = (client: ReturnType<typeof makeClient>): ExecutionContext =>
  ({
    switchToWs: () => ({ getClient: () => client }),
  }) as unknown as ExecutionContext;

describe('WsJwtAuthGuard', () => {
  let guard: WsJwtAuthGuard;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(() => {
    jwtService = { verify: jest.fn() } as unknown as jest.Mocked<JwtService>;
    guard = new WsJwtAuthGuard(jwtService);
  });

  it('throws WsException when no token is provided', () => {
    const client = makeClient();
    expect(() => guard.canActivate(makeContext(client))).toThrow(WsException);
    expect(() => guard.canActivate(makeContext(client))).toThrow('missing token');
  });

  it('throws WsException when token verification fails', () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('jwt expired');
    });
    const client = makeClient({ auth: { token: 'bad.token.here' } });
    expect(() => guard.canActivate(makeContext(client))).toThrow(WsException);
    expect(() => guard.canActivate(makeContext(client))).toThrow('invalid token');
  });

  it('returns true and sets client.data.user when token is valid (auth object)', () => {
    const payload = { sub: 'user-1', email: 'test@example.com' };
    jwtService.verify.mockReturnValue(payload as any);
    const client = makeClient({ auth: { token: 'valid.token' } });
    const result = guard.canActivate(makeContext(client));
    expect(result).toBe(true);
    expect(client.data.user).toEqual(payload);
  });

  it('returns true and sets client.data.user when token is in query param', () => {
    const payload = { sub: 'user-2', email: 'other@example.com' };
    jwtService.verify.mockReturnValue(payload as any);
    const client = makeClient({ query: { token: 'valid.query.token' } });
    const result = guard.canActivate(makeContext(client));
    expect(result).toBe(true);
    expect(client.data.user).toEqual(payload);
  });

  it('prefers auth.token over query.token', () => {
    const payload = { sub: 'user-3' };
    jwtService.verify.mockReturnValue(payload as any);
    const client = makeClient({ auth: { token: 'auth-token' }, query: { token: 'query-token' } });
    guard.canActivate(makeContext(client));
    expect(jwtService.verify).toHaveBeenCalledWith('auth-token', expect.any(Object));
  });
});
