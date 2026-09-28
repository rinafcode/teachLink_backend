import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROUTING_BYPASS_KEY, ROUTING_METADATA_KEY } from '../decorators/routing.decorator';
import { RoutingEngineService } from '../services/routing-engine.service';
import { RoutingContext } from '../interfaces/routing.interface';

/**
 * Guard that can be used to apply routing logic at the guard level
 */
@Injectable()
export class RoutingGuard implements CanActivate {
  private readonly logger = new Logger(RoutingGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly routingEngine: RoutingEngineService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if routing should be bypassed for this route
    const bypassRouting = this.reflector.getAllAndOverride<boolean>(ROUTING_BYPASS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (bypassRouting) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    // Get routing metadata from decorators
    const routingMetadata = this.reflector.getAllAndOverride<Record<string, any>>(
      ROUTING_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Build routing context
    const routingContext: RoutingContext = {
      request: {
        method: request.method,
        path: request.path,
        headers: this.normalizeHeaders(request.headers),
        query: request.query,
        body: request.body,
        ip: this.getClientIP(request),
        userAgent: request.get('user-agent'),
      },
      tenant: request.tenant,
      user: request.user,
      metadata: {
        ...routingMetadata,
        timestamp: new Date().toISOString(),
        handler: context.getHandler().name,
        controller: context.getClass().name,
      },
    };

    try {
      // Evaluate routing rules
      const routingResult = await this.routingEngine.evaluateRouting(routingContext);

      // Store result for potential use by other guards/interceptors
      request.routingResult = routingResult;

      // For guard usage, we typically only want to block requests
      if (routingResult.matched && routingResult.action?.type === 'block') {
        this.logger.warn(`Request blocked by routing rule: ${routingResult.rule?.name}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Error in routing guard', error);
      return true; // Allow request to continue on error
    }
  }

  /**
   * Normalizes headers to lowercase keys
   */
  private normalizeHeaders(headers: any): Record<string, string> {
    const normalized: Record<string, string> = {};

    Object.entries(headers).forEach(([key, value]) => {
      if (typeof value === 'string') {
        normalized[key.toLowerCase()] = value;
      } else if (Array.isArray(value)) {
        normalized[key.toLowerCase()] = value[0];
      }
    });

    return normalized;
  }

  /**
   * Gets client IP address from request
   */
  private getClientIP(req: any): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }
}
