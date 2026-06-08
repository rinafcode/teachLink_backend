import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { Request } from 'express';

export interface RequestFingerprint {
  /** One-way hash — no raw PII stored */
  hash: string;
  /** Coarse metadata safe for analytics */
  meta: {
    method: string;
    path: string;
    /** Truncated to /24 subnet for IPv4, /48 for IPv6 */
    ipSubnet: string;
    userAgent: string;
    acceptLanguage: string;
  };
}

@Injectable()
export class FingerprintService {
  /**
   * Builds a privacy-safe fingerprint from the incoming request.
   *
   * Privacy guarantees:
   *  - Full IP is never stored; only the network subnet is retained.
   *  - User-agent and accept-language are included as-is (non-PII headers).
   *  - The hash is a one-way SHA-256 digest — it cannot be reversed.
   */
  generate(req: Request): RequestFingerprint {
    const ip = this.extractIp(req);
    const ipSubnet = this.toSubnet(ip);
    const userAgent = (req.headers['user-agent'] ?? '').slice(0, 256);
    const acceptLanguage = (req.headers['accept-language'] ?? '').slice(0, 64);
    const method = req.method;
    const path = req.path;

    const raw = [ipSubnet, userAgent, acceptLanguage, method, path].join('|');
    const hash = createHash('sha256').update(raw).digest('hex');

    return { hash, meta: { method, path, ipSubnet, userAgent, acceptLanguage } };
  }

  /** Stable deduplication key scoped to a time window (default: 1 minute). */
  windowedKey(hash: string, windowMs = 60_000): string {
    const bucket = Math.floor(Date.now() / windowMs);
    return `fp:${hash}:${bucket}`;
  }

  // ── private helpers ──────────────────────────────────────────────────────

  private extractIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.ip ?? '0.0.0.0';
  }

  /** Truncates IP to subnet to avoid storing precise location. */
  private toSubnet(ip: string): string {
    if (ip.includes(':')) {
      // IPv6 → keep first 3 groups (/48)
      return ip.split(':').slice(0, 3).join(':') + '::/48';
    }
    // IPv4 → keep first 3 octets (/24)
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
    }
    return '0.0.0.0/24';
  }
}
