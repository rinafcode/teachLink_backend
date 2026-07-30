import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * IpAllowlistGuard
 *
 * Restricts access to admin endpoints to a configurable list of IPs / CIDR
 * ranges read from the ADMIN_IP_ALLOWLIST environment variable.
 *
 * Configuration
 * ─────────────
 * ADMIN_IP_ALLOWLIST=10.0.0.0/8,192.168.1.0/24,203.0.113.42
 *
 * Rules
 * ─────
 * - Comma-separated list of IPv4 addresses and/or CIDR blocks.
 * - If ADMIN_IP_ALLOWLIST is unset or empty the guard is disabled (all IPs
 *   are allowed) and a startup WARNING is logged.
 * - The client IP is resolved from X-Forwarded-For (first hop, i.e. the
 *   leftmost address, which is the original client before any trusted
 *   reverse proxies) and falls back to request.ip / socket.remoteAddress.
 * - Requests from unlisted IPs receive HTTP 403 Forbidden.
 *
 * CIDR matching is implemented without external dependencies using standard
 * bitwise arithmetic on IPv4 32-bit integers.
 */
@Injectable()
export class IpAllowlistGuard implements CanActivate, OnModuleInit {
  private readonly logger = new Logger(IpAllowlistGuard.name);

  /** Parsed allowlist entries: exact IPs and CIDR ranges */
  private allowlist: Array<
    { type: 'exact'; ip: string } | { type: 'cidr'; network: number; mask: number }
  > = [];
  private guardEnabled = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const raw = this.configService.get<string>('ADMIN_IP_ALLOWLIST', '').trim();

    if (!raw) {
      this.logger.warn(
        'ADMIN_IP_ALLOWLIST is not set — IpAllowlistGuard is DISABLED. ' +
          'All IPs are permitted on admin endpoints. Set ADMIN_IP_ALLOWLIST to enable.',
      );
      this.guardEnabled = false;
      return;
    }

    this.guardEnabled = true;
    this.allowlist = raw
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .map((entry) => this.parseEntry(entry))
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    this.logger.log(`IpAllowlistGuard enabled with ${this.allowlist.length} entries: ${raw}`);
  }

  canActivate(context: ExecutionContext): boolean {
    // Guard disabled — allow all traffic (with a logged warning at init)
    if (!this.guardEnabled) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const clientIp = this.resolveClientIp(request);

    if (!clientIp) {
      this.logger.warn('IpAllowlistGuard: unable to determine client IP — denying request');
      throw new ForbiddenException('Access denied: unable to determine client IP');
    }

    const allowed = this.isAllowed(clientIp);

    if (!allowed) {
      this.logger.warn(
        `IpAllowlistGuard: denied request from IP ${clientIp} — not in ADMIN_IP_ALLOWLIST`,
      );
      throw new ForbiddenException(
        `Access denied: IP address ${clientIp} is not in the admin allowlist`,
      );
    }

    return true;
  }

  // ---------------------------------------------------------------------------
  // IP resolution
  // ---------------------------------------------------------------------------

  /**
   * Resolves the originating client IP.
   *
   * X-Forwarded-For format: client, proxy1, proxy2, ...
   * We take the *first* value (leftmost = true client IP before trusted proxies).
   * This is correct when the application sits behind a reverse-proxy that
   * appends (not prepends) its own address.
   */
  resolveClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];

    if (forwarded) {
      const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      const first = raw.split(',')[0].trim();
      if (first) return this.normalizeIp(first);
    }

    const ip = request.ip ?? (request.socket?.remoteAddress as string | undefined);
    return ip ? this.normalizeIp(ip) : '';
  }

  /** Strip IPv6-mapped IPv4 prefix (::ffff:) so we only deal with plain IPv4 */
  private normalizeIp(ip: string): string {
    return ip.replace(/^::ffff:/, '').trim();
  }

  // ---------------------------------------------------------------------------
  // Allowlist matching
  // ---------------------------------------------------------------------------

  isAllowed(ip: string): boolean {
    const normalised = this.normalizeIp(ip);

    for (const entry of this.allowlist) {
      if (entry.type === 'exact') {
        if (entry.ip === normalised) return true;
      } else {
        if (this.matchesCidr(normalised, entry.network, entry.mask)) return true;
      }
    }

    return false;
  }

  // ---------------------------------------------------------------------------
  // CIDR helpers
  // ---------------------------------------------------------------------------

  /**
   * Parse a single allowlist entry into an exact-IP or CIDR descriptor.
   * Returns null (and logs a warning) for malformed entries.
   */
  private parseEntry(
    entry: string,
  ): { type: 'exact'; ip: string } | { type: 'cidr'; network: number; mask: number } | null {
    if (entry.includes('/')) {
      return this.parseCidr(entry);
    }

    if (!this.isValidIpv4(entry)) {
      this.logger.warn(`IpAllowlistGuard: ignoring invalid entry "${entry}"`);
      return null;
    }

    return { type: 'exact', ip: entry };
  }

  private parseCidr(cidr: string): { type: 'cidr'; network: number; mask: number } | null {
    const parts = cidr.split('/');
    if (parts.length !== 2) {
      this.logger.warn(`IpAllowlistGuard: ignoring malformed CIDR "${cidr}"`);
      return null;
    }

    const [address, prefixStr] = parts;
    const prefix = parseInt(prefixStr, 10);

    if (!this.isValidIpv4(address) || isNaN(prefix) || prefix < 0 || prefix > 32) {
      this.logger.warn(`IpAllowlistGuard: ignoring invalid CIDR "${cidr}"`);
      return null;
    }

    const network = this.ipToInt(address);
    // Build a bitmask: prefix bits set to 1, rest 0.
    // Use unsigned right-shift to keep it as a 32-bit unsigned integer.
    const mask = prefix === 0 ? 0 : (-1 << (32 - prefix)) >>> 0;

    return { type: 'cidr', network: network & mask, mask };
  }

  /**
   * Check whether `ip` falls within the CIDR block defined by `network/mask`.
   * Both `network` and `mask` are pre-computed 32-bit unsigned integers.
   */
  private matchesCidr(ip: string, network: number, mask: number): boolean {
    if (!this.isValidIpv4(ip)) return false;
    const ipInt = this.ipToInt(ip);
    return (ipInt & mask) === network;
  }

  /** Convert a dotted-decimal IPv4 string to a 32-bit unsigned integer */
  ipToInt(ip: string): number {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  }

  /** Simple IPv4 format validator */
  isValidIpv4(ip: string): boolean {
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    return parts.every((part) => {
      const n = parseInt(part, 10);
      return !isNaN(n) && n >= 0 && n <= 255 && String(n) === part;
    });
  }
}
