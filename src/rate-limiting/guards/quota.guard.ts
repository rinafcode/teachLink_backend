import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { RateLimitExceededException } from '../../common/exceptions/app.exceptions';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { QuotaTrackingService } from '../services/quota-tracking.service';
import { QUOTA_KEY, QuotaOptions } from '../decorators/quota.decorator';
import {
  UserTier,
  INTERNAL_SERVICE_HEADER,
  getTrustedIps,
  ADMIN_ROLES,
} from '../rate-limiting.constants';

/**
 * Global quota guard — checks per-user consumption before each request.
 *
 * Resolution order for userId/tier:
 *   1. request.user (JWT-populated by AuthGuard)
 *   2. Falls back to IP-based tracking with FREE tier if unauthenticated
 *
 * Bypass order (checked before quota is enforced):
 *   1. @SkipQuota() / @UseQuota({ skip: true }) decorator
 *   2. Request IP is in RATE_LIMIT_TRUSTED_IPS env var
 *   3. Valid X-Internal-Service-Key header matches INTERNAL_SERVICE_KEY env var
 *   4. Authenticated user carries an admin role
 *
 * Injects standard rate-limit headers on every response so clients can
 * observe their remaining quota without hitting 429s.
 */
@Injectable()
export class QuotaGuard implements CanActivate {
  private readonly logger = new Logger(QuotaGuard.name);
  private readonly trustedIps: Set<string> = getTrustedIps();
  private readonly internalKey: string | undefined = process.env.INTERNAL_SERVICE_KEY;

  constructor(
    private readonly reflector: Reflector,
    private readonly tracking: QuotaTrackingService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<QuotaOptions>(QUOTA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (options?.skip) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: any }>();
    const res = context.switchToHttp().getResponse<Response>();

    if (this.isWhitelisted(req)) return true;
    if (this.isAdminUser(req.user)) return true;

    // Use user:{id} format for authenticated users, ip:{address} for unauthenticated
    const identifier: string =
      (req.user?.id ?? req.user?.sub)
        ? `user:${req.user?.id ?? req.user?.sub}`
        : this.resolveIp(req);
    const tier: UserTier = options?.tier ?? this.resolveTier(req.user);

    const result = await this.tracking.checkAndIncrement(identifier, tier);

    res.setHeader('X-RateLimit-Limit-Minute', result.limit.minute);
    res.setHeader('X-RateLimit-Limit-Hour', result.limit.hour);
    res.setHeader('X-RateLimit-Limit-Day', result.limit.day);
    res.setHeader('X-RateLimit-Remaining-Minute', result.remaining.minute);
    res.setHeader('X-RateLimit-Remaining-Hour', result.remaining.hour);
    res.setHeader('X-RateLimit-Remaining-Day', result.remaining.day);

    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfter ?? 60);
      this.logger.warn(
        `Quota exceeded identifier=${identifier} tier=${tier} retryAfter=${result.retryAfter}s`,
      );
      throw new RateLimitExceededException(result.retryAfter);
    }

    return true;
  }

  private isWhitelisted(req: Request): boolean {
    const ip = this.resolveRawIp(req);
    if (ip && this.trustedIps.has(ip)) return true;

    if (this.internalKey) {
      const header = req.headers[INTERNAL_SERVICE_HEADER];
      if (header === this.internalKey) return true;
    }

    return false;
  }

  private isAdminUser(user?: any): boolean {
    if (!user) return false;
    const role: string = (user.role ?? user['https://teachlink.io/role'] ?? '').toString();
    if (ADMIN_ROLES.has(role)) return true;
    const roles: string[] = Array.isArray(user.roles) ? user.roles : [];
    return roles.some((r) => {
      const name = typeof r === 'string' ? r : ((r as { name?: string })?.name ?? '');
      return ADMIN_ROLES.has(name);
    });
  }

  private resolveTier(user?: any): UserTier {
    if (!user) return UserTier.UNAUTHENTICATED;
    const raw = (user.tier ?? user.plan ?? 'FREE').toString().toUpperCase();
    return UserTier[raw as keyof typeof UserTier] ?? UserTier.FREE;
  }

  private resolveRawIp(req: Request): string | undefined {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
    return req.ip ?? req.socket?.remoteAddress;
  }

  private resolveIp(req: Request): string {
    return `ip:${this.resolveRawIp(req) ?? 'unknown'}`;
  }
}
