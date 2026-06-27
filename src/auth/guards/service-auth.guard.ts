import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

/**
 * Simple service-to-service authentication guard.
 * Expects an `x-service-token: Bearer <jwt>` header signed with SERVICE_JWT_SECRET.
 */
@Injectable()
export class ServiceAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const raw = req.headers['x-service-token'] || req.headers['x-service-auth'];
    if (!raw) return false;

    const token = Array.isArray(raw) ? raw[0] : raw;
    const parts = token.split(' ');
    const maybe = parts.length === 2 ? parts[1] : parts[0];

    try {
      const payload = this.jwtService.verify(maybe, {
        secret: process.env.SERVICE_JWT_SECRET || 'default-service-secret',
        algorithms: ['HS256'],
      });

      // Basic validation: service claim and allowed list
      const serviceName = (payload as any).service as string | undefined;
      const allowed = (process.env.SERVICE_ALLOW_LIST || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      if (!serviceName) throw new UnauthorizedException('Invalid service token');
      if (allowed.length > 0 && !allowed.includes(serviceName)) {
        throw new UnauthorizedException('Service not allowed');
      }

      // attach service identity for downstream usage
      (req as any).serviceIdentity = { name: serviceName, claims: payload };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid service token');
    }
  }
}
