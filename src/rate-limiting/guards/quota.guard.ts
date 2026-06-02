import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { RateLimitExceededException } from '../../common/exceptions/app.exceptions';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { QuotaTrackingService } from '../services/quota-tracking.service';
import { QUOTA_KEY, QuotaOptions } from '../decorators/quota.decorator';
import { UserTier } from '../rate-limiting.constants';

/**
 * Global quota guard — checks per-user consumption before each request.
 *
 * Resolution order for userId/tier:
 *   1. request.user (JWT-populated by AuthGuard)
 *   2. Falls back to IP-based tracking with FREE tier if unauthenticated
 *
 * Injects standard rate-limit headers on every response so clients can
 * observe their remaining quota without hitting 429s.
 */
@Injectable()
export class QuotaGuard implements CanActivate {
  private readonly logger = new Logger(QuotaGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly tracking: QuotaTrackingService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check for @SkipQuota or @UseQuota({ skip: true })
    const options = this.reflector.getAllAndOverride<QuotaOptions>(QUOTA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (options?.skip) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: any }>();
    const res = context.switchToHttp().getResponse<Response>();

    // Resolve identity — authenticated user or fall back to IP
    const userId: string = req.user?.id ?? req.user?.sub ?? this.resolveIp(req);
    const tier: UserTier = options?.tier ?? this.resolveTier(req.user);

    const result = await this.tracking.checkAndIncrement(userId, tier);

    // Always inject quota headers
    res.setHeader('X-RateLimit-Limit-Minute', result.limit.minute);
    res.setHeader('X-RateLimit-Limit-Hour', result.limit.hour);
    res.setHeader('X-RateLimit-Limit-Day', result.limit.day);
    res.setHeader('X-RateLimit-Remaining-Minute', result.remaining.minute);
    res.setHeader('X-RateLimit-Remaining-Hour', result.remaining.hour);
    res.setHeader('X-RateLimit-Remaining-Day', result.remaining.day);

    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfter ?? 60);

      this.logger.warn(
        `Quota exceeded userId=${userId} tier=${tier} retryAfter=${result.retryAfter}s`,
      );

      throw new RateLimitExceededException(result.retryAfter);
    }

    return true;
  }

  private resolveTier(user?: any): UserTier {
    if (!user) return UserTier.FREE;
    // Map user.tier or user.plan field; default to FREE
    const raw = (user.tier ?? user.plan ?? 'FREE').toString().toUpperCase();
    return UserTier[raw as keyof typeof UserTier] ?? UserTier.FREE;
  }

  private resolveIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') return `ip:${forwarded.split(',')[0].trim()}`;
    return `ip:${req.ip ?? req.socket?.remoteAddress ?? 'unknown'}`;
  }
}
