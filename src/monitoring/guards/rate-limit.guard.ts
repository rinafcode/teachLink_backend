import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { CachingService } from '../../caching/caching.service';

export const RATE_LIMIT_KEY = 'rate_limit';

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum number of requests per window
  keyGenerator?: (req: any) => string;
  skipIf?: (req: any) => boolean;
  message?: string;
}

export function RateLimit(options: RateLimitOptions) {
  return (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) => {
    Reflect.defineMetadata(RATE_LIMIT_KEY, options, descriptor.value);
    return descriptor;
  };
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly caching: CachingService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rateLimitOptions = this.reflector.get<RateLimitOptions>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );

    if (!rateLimitOptions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    // Check skip condition
    if (rateLimitOptions.skipIf && rateLimitOptions.skipIf(request)) {
      return true;
    }

    const key = this.generateKey(request, rateLimitOptions);
    const now = Date.now();
    const windowStart = now - rateLimitOptions.windowMs;

    try {
      // Get current request count
      const requestLog =
        (await this.caching.get<number[]>(`rate_limit:${key}`)) || [];

      // Filter requests within the current window
      const requestsInWindow = requestLog.filter(
        (timestamp) => timestamp > windowStart,
      );

      if (requestsInWindow.length >= rateLimitOptions.max) {
        this.logger.warn(`Rate limit exceeded for key: ${key}`);
        throw new HttpException(
          rateLimitOptions.message || 'Rate limit exceeded',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Add current request timestamp
      requestsInWindow.push(now);

      // Store updated request log
      await this.caching.set(`rate_limit:${key}`, requestsInWindow, {
        ttl: Math.ceil(rateLimitOptions.windowMs / 1000),
      });

      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Rate limit guard error for key ${key}`, error);
      return true; // Allow request on error
    }
  }

  private generateKey(request: any, options: RateLimitOptions): string {
    if (options.keyGenerator) {
      return options.keyGenerator(request);
    }

    // Default key generation based on IP and user
    const ip = request.ip || request.connection.remoteAddress;
    const userId = request.user?.id || 'anonymous';
    const endpoint = `${request.method}:${request.route?.path || request.path}`;

    return `${ip}:${userId}:${endpoint}`;
  }
}
