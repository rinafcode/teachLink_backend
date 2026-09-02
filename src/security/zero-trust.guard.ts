import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuditLoggingService } from './audit/audit-logging.service';
import { ServiceAuthService } from './service-auth.service';

/**
 * ZeroTrustGuard implements the zero-trust security principle:
 * "Never trust, always verify."
 *
 * Every inbound request must present one of:
 *   1. A valid Bearer JWT (end-user traffic) — verified by the JwtAuthGuard
 *      further downstream; this guard checks for its *presence*.
 *   2. A valid service-to-service HMAC token (X-Service-Token header).
 *
 * Requests that carry neither are rejected with 401 before they reach any
 * controller.  All decisions — both allow and deny — are written to the audit
 * log so that a complete identity trail exists for every request.
 *
 * Health-check and metrics paths are explicitly allow-listed so that
 * infrastructure probes are never accidentally blocked.
 */
@Injectable()
export class ZeroTrustGuard implements CanActivate {
  private readonly logger = new Logger(ZeroTrustGuard.name);

  /** Paths that are exempt from identity verification. */
  private static readonly PUBLIC_PATHS = new Set([
    '/health',
    '/metrics',
    '/api/docs',
    '/api/docs-json',
    '/favicon.ico',
  ]);

  constructor(
    private readonly auditLogging: AuditLoggingService,
    private readonly serviceAuth: ServiceAuthService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const path = req.path ?? req.url ?? '';
    const ip = this.extractIp(req);

    // Allow-listed infrastructure paths pass without verification.
    if (ZeroTrustGuard.isPublicPath(path)) {
      return true;
    }

    // 1. Check for service-to-service token.
    const serviceToken = req.headers['x-service-token'];
    if (serviceToken && typeof serviceToken === 'string') {
      if (this.serviceAuth.verifyServiceToken(serviceToken)) {
        this.auditLogging.log('ZERO_TRUST_SERVICE_AUTH', {
          path,
          ip,
          method: req.method,
          result: 'ALLOWED',
        });
        return true;
      }

      this.logger.warn(`Invalid service token from ${ip} for ${path}`);
      this.auditLogging.log('ZERO_TRUST_SERVICE_AUTH', {
        path,
        ip,
        method: req.method,
        result: 'DENIED',
        reason: 'invalid_service_token',
      });
      throw new UnauthorizedException('Invalid service token');
    }

    // 2. Check for user Bearer token presence (JWT validation is delegated to
    //    JwtAuthGuard on individual routes; here we only verify the header
    //    exists so that completely unauthenticated requests are caught early).
    const authorization = req.headers['authorization'];
    if (authorization && authorization.startsWith('Bearer ')) {
      this.auditLogging.log('ZERO_TRUST_USER_AUTH', {
        path,
        ip,
        method: req.method,
        result: 'ALLOWED',
      });
      return true;
    }

    // 3. No identity credential present — deny.
    this.logger.warn(`Unauthenticated request from ${ip} to ${path}`);
    this.auditLogging.log('ZERO_TRUST_DENY', {
      path,
      ip,
      method: req.method,
      result: 'DENIED',
      reason: 'no_identity_credential',
    });
    throw new UnauthorizedException('Identity verification required');
  }

  /** Returns true when the path should bypass identity verification. */
  static isPublicPath(path: string): boolean {
    if (ZeroTrustGuard.PUBLIC_PATHS.has(path)) {
      return true;
    }
    // Also allow any sub-path under /api/docs (Swagger assets).
    if (path.startsWith('/api/docs')) {
      return true;
    }
    return false;
  }

  private extractIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
    }
    return req.socket?.remoteAddress ?? 'unknown';
  }
}
