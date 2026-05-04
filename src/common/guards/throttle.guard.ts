import { Injectable, ExecutionContext, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail } from '@nestjs/throttler';
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
    protected override async throwThrottlingException(context: ExecutionContext, throttlerLimitDetail: ThrottlerLimitDetail): Promise<void> {
        const request = context.switchToHttp().getRequest<Request>();
        const response = context.switchToHttp().getResponse<Response>();
        const ip = this.resolveClientIp(request);
        const route = request.route?.path ?? request.url;
        this.logger.warn(`Rate limit exceeded: ip=${ip} method=${request.method} route=${route}`);
        // Inject standard rate-limit headers so clients can back off gracefully
        // TTL in v6 is in seconds if defined that way in config, but throttlerLimitDetail.ttl is the value from config
        const ttlSeconds = throttlerLimitDetail.ttl;
        response.setHeader('Retry-After', ttlSeconds);
        response.setHeader('X-RateLimit-Limit', throttlerLimitDetail.limit);
        response.setHeader('X-RateLimit-Remaining', 0);
        response.setHeader('X-RateLimit-Reset', Math.floor(Date.now() / 1000) + ttlSeconds);
        throw new HttpException({
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            error: 'Too Many Requests',
            message: 'You have exceeded the request rate limit. Please wait before retrying.',
            retryAfterSeconds: ttlSeconds,
        }, HttpStatus.TOO_MANY_REQUESTS);
    }
    private resolveClientIp(request: Request): string {
        const forwarded = request.headers['x-forwarded-for'];
        if (typeof forwarded === 'string')
            return forwarded.split(',')[0].trim();
        return request.ip ?? request.socket?.remoteAddress ?? 'unknown';
    }
}
