import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { IpAllowlistGuard } from './ip-allowlist.guard';

/** Build a minimal ExecutionContext with the given IP / headers */
function makeContext(options: {
  ip?: string;
  remoteAddress?: string;
  xForwardedFor?: string | string[];
}): ExecutionContext {
  const request: Record<string, unknown> = {
    ip: options.ip ?? null,
    socket: { remoteAddress: options.remoteAddress ?? null },
    headers: {} as Record<string, unknown>,
    route: { path: '/test' },
  };

  if (options.xForwardedFor !== undefined) {
    (request.headers as Record<string, unknown>)['x-forwarded-for'] = options.xForwardedFor;
  }

  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

/** Bootstrap a guard with a given ADMIN_IP_ALLOWLIST value */
async function buildGuard(allowlist: string): Promise<IpAllowlistGuard> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      IpAllowlistGuard,
      {
        provide: ConfigService,
        useValue: {
          get: (key: string, def = '') => (key === 'ADMIN_IP_ALLOWLIST' ? allowlist : def),
        },
      },
    ],
  }).compile();

  const guard = module.get<IpAllowlistGuard>(IpAllowlistGuard);
  guard.onModuleInit(); // trigger parsing
  return guard;
}

// ─────────────────────────────────────────────────────────────────────────────
// ipToInt / isValidIpv4 helpers
// ─────────────────────────────────────────────────────────────────────────────
describe('IpAllowlistGuard – internal helpers', () => {
  let guard: IpAllowlistGuard;

  beforeEach(async () => {
    guard = await buildGuard('10.0.0.1');
  });

  describe('isValidIpv4', () => {
    it('accepts valid IPv4 addresses', () => {
      expect(guard.isValidIpv4('0.0.0.0')).toBe(true);
      expect(guard.isValidIpv4('255.255.255.255')).toBe(true);
      expect(guard.isValidIpv4('192.168.1.100')).toBe(true);
      expect(guard.isValidIpv4('10.0.0.1')).toBe(true);
    });

    it('rejects invalid IPv4 addresses', () => {
      expect(guard.isValidIpv4('256.0.0.1')).toBe(false);
      expect(guard.isValidIpv4('192.168.1')).toBe(false);
      expect(guard.isValidIpv4('not-an-ip')).toBe(false);
      expect(guard.isValidIpv4('::1')).toBe(false);
      expect(guard.isValidIpv4('')).toBe(false);
      expect(guard.isValidIpv4('1.2.3.04')).toBe(false); // leading zero
    });
  });

  describe('ipToInt', () => {
    it('converts known addresses correctly', () => {
      expect(guard.ipToInt('0.0.0.0')).toBe(0);
      expect(guard.ipToInt('0.0.0.1')).toBe(1);
      expect(guard.ipToInt('255.255.255.255')).toBe(0xffffffff);
      expect(guard.ipToInt('10.0.0.0')).toBe(0x0a000000);
      expect(guard.ipToInt('192.168.1.1')).toBe(0xc0a80101);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Guard disabled when ADMIN_IP_ALLOWLIST is unset
// ─────────────────────────────────────────────────────────────────────────────
describe('IpAllowlistGuard – disabled (no allowlist)', () => {
  it('allows any IP when ADMIN_IP_ALLOWLIST is empty', async () => {
    const guard = await buildGuard('');
    const ctx = makeContext({ ip: '1.2.3.4' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows any IP when ADMIN_IP_ALLOWLIST is whitespace', async () => {
    const guard = await buildGuard('   ');
    const ctx = makeContext({ ip: '99.99.99.99' });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Exact IP matching
// ─────────────────────────────────────────────────────────────────────────────
describe('IpAllowlistGuard – exact IP matching', () => {
  let guard: IpAllowlistGuard;

  beforeEach(async () => {
    guard = await buildGuard('10.0.0.1,192.168.0.50');
  });

  it('allows a listed IP', () => {
    const ctx = makeContext({ ip: '10.0.0.1' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows the second listed IP', () => {
    const ctx = makeContext({ ip: '192.168.0.50' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('denies an unlisted IP with 403', () => {
    const ctx = makeContext({ ip: '10.0.0.2' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('denies another unlisted IP with 403', () => {
    const ctx = makeContext({ ip: '172.16.0.1' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CIDR matching
// ─────────────────────────────────────────────────────────────────────────────
describe('IpAllowlistGuard – CIDR matching', () => {
  describe('10.0.0.0/8', () => {
    let guard: IpAllowlistGuard;

    beforeEach(async () => {
      guard = await buildGuard('10.0.0.0/8');
    });

    it('allows first address in /8', () => {
      expect(guard.isAllowed('10.0.0.0')).toBe(true);
    });

    it('allows an address deep in /8', () => {
      expect(guard.isAllowed('10.255.255.255')).toBe(true);
    });

    it('allows a mid-range address in /8', () => {
      expect(guard.isAllowed('10.10.10.10')).toBe(true);
    });

    it('denies an address outside /8', () => {
      expect(guard.isAllowed('11.0.0.1')).toBe(false);
    });

    it('denies 192.168.x.x when only 10/8 is listed', () => {
      expect(guard.isAllowed('192.168.1.1')).toBe(false);
    });
  });

  describe('192.168.1.0/24', () => {
    let guard: IpAllowlistGuard;

    beforeEach(async () => {
      guard = await buildGuard('192.168.1.0/24');
    });

    it('allows .1 in /24', () => {
      expect(guard.isAllowed('192.168.1.1')).toBe(true);
    });

    it('allows .254 in /24', () => {
      expect(guard.isAllowed('192.168.1.254')).toBe(true);
    });

    it('denies address in adjacent /24', () => {
      expect(guard.isAllowed('192.168.2.1')).toBe(false);
    });

    it('denies address in different class', () => {
      expect(guard.isAllowed('10.0.0.1')).toBe(false);
    });
  });

  describe('172.16.0.0/12', () => {
    let guard: IpAllowlistGuard;

    beforeEach(async () => {
      guard = await buildGuard('172.16.0.0/12');
    });

    it('allows 172.16.0.1', () => {
      expect(guard.isAllowed('172.16.0.1')).toBe(true);
    });

    it('allows 172.31.255.255 (last in /12)', () => {
      expect(guard.isAllowed('172.31.255.255')).toBe(true);
    });

    it('denies 172.32.0.0 (just outside /12)', () => {
      expect(guard.isAllowed('172.32.0.0')).toBe(false);
    });
  });

  describe('host route /32', () => {
    let guard: IpAllowlistGuard;

    beforeEach(async () => {
      guard = await buildGuard('203.0.113.42/32');
    });

    it('allows exact host', () => {
      expect(guard.isAllowed('203.0.113.42')).toBe(true);
    });

    it('denies adjacent host', () => {
      expect(guard.isAllowed('203.0.113.43')).toBe(false);
    });
  });

  describe('mixed list: exact + CIDR', () => {
    let guard: IpAllowlistGuard;

    beforeEach(async () => {
      guard = await buildGuard('10.0.0.0/8,203.0.113.5');
    });

    it('allows IP in CIDR', () => {
      expect(guard.isAllowed('10.1.2.3')).toBe(true);
    });

    it('allows exact IP', () => {
      expect(guard.isAllowed('203.0.113.5')).toBe(true);
    });

    it('denies IP not in CIDR or exact list', () => {
      expect(guard.isAllowed('203.0.113.6')).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// X-Forwarded-For handling
// ─────────────────────────────────────────────────────────────────────────────
describe('IpAllowlistGuard – X-Forwarded-For', () => {
  let guard: IpAllowlistGuard;

  beforeEach(async () => {
    guard = await buildGuard('10.0.0.1');
  });

  it('uses the first (leftmost) IP from X-Forwarded-For', () => {
    const ctx = makeContext({ xForwardedFor: '10.0.0.1, 172.16.0.1, 192.168.0.1' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('denies when the first IP in X-Forwarded-For is not listed', () => {
    const ctx = makeContext({ xForwardedFor: '5.5.5.5, 10.0.0.1' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('handles array-format X-Forwarded-For header', () => {
    const ctx = makeContext({ xForwardedFor: ['10.0.0.1, 172.16.0.1'] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('strips IPv6-mapped IPv4 prefix (::ffff:)', () => {
    const ctx = makeContext({ ip: '::ffff:10.0.0.1' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('falls back to request.ip when no X-Forwarded-For', () => {
    const ctx = makeContext({ ip: '10.0.0.1' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('falls back to socket.remoteAddress when request.ip is absent', () => {
    const ctx = makeContext({ remoteAddress: '10.0.0.1' });
    expect(guard.canActivate(ctx)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases
// ─────────────────────────────────────────────────────────────────────────────
describe('IpAllowlistGuard – edge cases', () => {
  it('ignores malformed CIDR entries and still processes valid ones', async () => {
    const guard = await buildGuard('bad-entry,10.0.0.1,999.0.0.0/8');
    expect(guard.isAllowed('10.0.0.1')).toBe(true);
    expect(guard.isAllowed('10.0.0.2')).toBe(false);
  });

  it('throws 403 when client IP cannot be determined', async () => {
    const guard = await buildGuard('10.0.0.1');
    const ctx = makeContext({}); // no ip, no socket, no header
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
