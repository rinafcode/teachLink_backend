import { ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WsAuthGuard } from './ws-auth.guard';
import { WsException } from '@nestjs/websockets';

const VALID_SECRET = 'a-test-secret-that-is-long-enough-32chars';

function makeContext(token: unknown): ExecutionContext {
  const client = {
    id: 'socket-1',
    handshake: { auth: { token } },
    data: {},
    disconnect: jest.fn(),
  };
  return {
    switchToWs: () => ({ getClient: () => client }),
  } as unknown as ExecutionContext;
}

describe('WsAuthGuard', () => {
  let guard: WsAuthGuard;
  let jwtService: JwtService;

  beforeEach(() => {
    jwtService = new JwtService({});
    const config = { getOrThrow: jest.fn().mockReturnValue(VALID_SECRET) } as unknown as ConfigService;
    guard = new WsAuthGuard(jwtService, config);
  });

  it('allows connection with a valid token', () => {
    const token = jwtService.sign({ sub: 'user-1' }, { secret: VALID_SECRET });
    const ctx = makeContext(token);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rejects connection when token is missing', () => {
    const ctx = makeContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(WsException);
    expect((ctx.switchToWs().getClient() as any).disconnect).toHaveBeenCalledWith(true);
  });

  it('rejects connection when token is expired', () => {
    const token = jwtService.sign(
      { sub: 'user-1' },
      { secret: VALID_SECRET, expiresIn: '-1s' },
    );
    const ctx = makeContext(token);
    expect(() => guard.canActivate(ctx)).toThrow(WsException);
    expect((ctx.switchToWs().getClient() as any).disconnect).toHaveBeenCalledWith(true);
  });

  it('rejects connection when token is signed with wrong secret', () => {
    const token = jwtService.sign({ sub: 'user-1' }, { secret: 'wrong-secret-xxxxxxxxxxxxxxxxxxxxxxxxx' });
    const ctx = makeContext(token);
    expect(() => guard.canActivate(ctx)).toThrow(WsException);
  });

  it('attaches verified payload to socket.data.user', () => {
    const token = jwtService.sign({ sub: 'user-42', email: 'a@b.com' }, { secret: VALID_SECRET });
    const ctx = makeContext(token);
    guard.canActivate(ctx);
    const client = ctx.switchToWs().getClient() as any;
    expect(client.data.user.sub).toBe('user-42');
  });
});