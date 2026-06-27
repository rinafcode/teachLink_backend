import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { CanActivate } from '@nestjs/common/interfaces';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ServiceAuthGuard } from './service-auth.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Composite global guard that enforces either user identity (JWT) or
 * service-to-service identity (service token). Routes can be marked
 * public using the `@Public()` decorator.
 */
@Injectable()
export class GlobalAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtGuard: JwtAuthGuard,
    private readonly serviceGuard: ServiceAuthGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Try user JWT first
    try {
      const result = (await this.jwtGuard.canActivate(context)) as boolean;
      if (result) return true;
    } catch {
      // continue to try service guard
    }

    // Try service token
    try {
      const result = (await this.serviceGuard.canActivate(context)) as boolean;
      if (result) return true;
    } catch {
      // both failed
    }

    throw new UnauthorizedException('Authentication required');
  }
}
