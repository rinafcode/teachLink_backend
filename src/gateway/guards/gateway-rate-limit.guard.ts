import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import type { RateLimitState } from '../interfaces/gateway.interfaces';
import { GatewayRoutingService } from '../services/gateway-routing.service';

@Injectable()
export class GatewayRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(GatewayRateLimitGuard.name);
  private readonly store = new Map<string, RateLimitState>();

  constructor(private readonly routing: GatewayRoutingService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const rawService = req.params?.service;
    const service = Array.isArray(rawService) ? rawService[0] : (rawService ?? 'default');
    const clientIp = (req.ip ?? 'unknown').replace(/^::ffff:/, '');

    let route;
    try {
      route = this.routing.getRoute(service);
    } catch {
      // Unknown service — let the controller handle the 404
      return true;
    }

    const limit = route.rateLimitPerMinute;
    const key = `${service}:${clientIp}`;
    const now = Date.now();
    const windowMs = 60_000;

    const state = this.store.get(key);

    if (!state || now > state.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }

    if (state.count >= limit) {
      this.logger.warn(`Rate limit exceeded for ${key} (${state.count}/${limit})`);
      throw new HttpException(
        `Rate limit of ${limit} req/min exceeded for service "${service}"`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    state.count += 1;
    return true;
  }
}
