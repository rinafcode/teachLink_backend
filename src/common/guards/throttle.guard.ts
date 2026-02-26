import {
  Injectable,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { Request, Response } from 'express';

/**
 * #155 – CustomThrottleGuard
 *
 * Extends the built-in ThrottlerGuard to:
 *  - Return a structured error body consistent with GlobalExceptionFilter
 *  - Log rate-limit violations with client IP and route
 *  - Inject standard Retry-After and X-RateLimit-* headers
 */
@Injectable()
export class CustomThrottleGuard extends ThrottlerGuard {
  private readonly logger = new Logger(CustomThrottleGuard.name);

  /** Called by ThrottlerGuard when the limit is exceeded. */
  protected override throwThrottlingException(
    context: ExecutionContext,
  ): Promise<void> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const ip = this.resolveClientIp(request);
    const route = request.route?.path ?? request.url;

    this.logger.warn(
      `Rate limit exceeded: ip=${ip} method=${request.method} route=${route}`,
    );

    // Inject standard rate-limit headers so clients can back off gracefully
    response.setHeader('Retry-After', '60');
    response.setHeader('X-RateLimit-Exceeded', 'true');

    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message:
          'You have exceeded the request rate limit. Please wait before retrying.',
        retryAfterSeconds: 60,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private resolveClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
    return request.ip ?? request.socket?.remoteAddress ?? 'unknown';
  }
}