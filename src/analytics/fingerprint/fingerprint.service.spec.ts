import { Request } from 'express';
import { FingerprintService } from './fingerprint.service';

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    path: '/test',
    ip: '192.168.1.42',
    headers: {
      'user-agent': 'TestAgent/1.0',
      'accept-language': 'en-US',
    },
    ...overrides,
  } as unknown as Request;
}

describe('FingerprintService', () => {
  let svc: FingerprintService;

  beforeEach(() => {
    svc = new FingerprintService();
  });

  describe('generate', () => {
    it('returns a 64-char hex hash', () => {
      const fp = svc.generate(makeReq());
      expect(fp.hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('truncates IPv4 to /24 subnet', () => {
      const fp = svc.generate(makeReq({ ip: '10.20.30.99' }));
      expect(fp.meta.ipSubnet).toBe('10.20.30.0/24');
    });

    it('truncates IPv6 to /48 subnet', () => {
      const fp = svc.generate(makeReq({ ip: '2001:db8:85a3::8a2e:370:7334' }));
      expect(fp.meta.ipSubnet).toBe('2001:db8:85a3::/48');
    });

    it('uses x-forwarded-for when present', () => {
      const req = makeReq({
        headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
      });
      const fp = svc.generate(req);
      expect(fp.meta.ipSubnet).toBe('203.0.113.0/24');
    });

    it('produces the same hash for identical requests', () => {
      const fp1 = svc.generate(makeReq());
      const fp2 = svc.generate(makeReq());
      expect(fp1.hash).toBe(fp2.hash);
    });

    it('produces different hashes for different IPs', () => {
      const fp1 = svc.generate(makeReq({ ip: '1.2.3.4' }));
      const fp2 = svc.generate(makeReq({ ip: '5.6.7.8' }));
      expect(fp1.hash).not.toBe(fp2.hash);
    });

    it('produces different hashes for different paths', () => {
      const fp1 = svc.generate(makeReq({ path: '/a' }));
      const fp2 = svc.generate(makeReq({ path: '/b' }));
      expect(fp1.hash).not.toBe(fp2.hash);
    });

    it('does not include raw IP in the fingerprint meta', () => {
      const fp = svc.generate(makeReq({ ip: '192.168.1.42' }));
      // meta should only expose the subnet, not the full IP
      expect(fp.meta.ipSubnet).not.toBe('192.168.1.42');
      expect(fp.meta.ipSubnet).toBe('192.168.1.0/24');
    });

    it('handles missing headers gracefully', () => {
      const req = makeReq({ headers: {} });
      expect(() => svc.generate(req)).not.toThrow();
    });

    it('handles missing ip gracefully', () => {
      const req = makeReq({ ip: undefined });
      expect(() => svc.generate(req)).not.toThrow();
    });
  });

  describe('windowedKey', () => {
    it('returns a string prefixed with fp:', () => {
      const key = svc.windowedKey('abc123');
      expect(key).toMatch(/^fp:abc123:\d+$/);
    });

    it('returns the same key within the same window', () => {
      const hash = 'deadbeef';
      const k1 = svc.windowedKey(hash, 60_000);
      const k2 = svc.windowedKey(hash, 60_000);
      expect(k1).toBe(k2);
    });

    it('returns different keys for different hashes', () => {
      const k1 = svc.windowedKey('aaa');
      const k2 = svc.windowedKey('bbb');
      expect(k1).not.toBe(k2);
    });
  });
});
