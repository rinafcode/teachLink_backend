import { Injectable, NestMiddleware, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RoutingEngineService } from '../services/routing-engine.service';
import { RoutingConfigService } from '../services/routing-config.service';
import { RoutingContext, RoutingActionType } from '../interfaces/routing.interface';

interface ExtendedRequest extends Request {
  user?: {
    id: string;
    role: string;
    permissions?: string[];
  };
  tenant?: {
    id: string;
    slug: string;
    domain: string;
  };
  routingResult?: any;
}

/**
 * Middleware that applies content-based routing rules
 */
@Injectable()
export class ContentRoutingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ContentRoutingMiddleware.name);

  constructor(
    private readonly routingEngine: RoutingEngineService,
    private readonly routingConfig: RoutingConfigService
  ) {}

  async use(req: ExtendedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Update routing engine with latest config
      const config = this.routingConfig.getConfig();
      this.routingEngine.updateConfig(config);

      // Build routing context
      const context: RoutingContext = {
        request: {
          method: req.method,
          path: req.path,
          headers: this.normalizeHeaders(req.headers),
          query: req.query as Record<string, any>,
          body: req.body,
          ip: this.getClientIP(req),
          userAgent: req.get('user-agent')
        },
        tenant: req.tenant,
        user: req.user ? {
          ...req.user,
          permissions: req.user.permissions || []
        } : undefined,
        metadata: {
          timestamp: new Date().toISOString(),
          originalUrl: req.originalUrl,
          protocol: req.protocol,
          secure: req.secure
        }
      };

      // Evaluate routing rules
      const routingResult = await this.routingEngine.evaluateRouting(context);
      
      // Store result for potential use by other middleware/controllers
      req.routingResult = routingResult;

      // Apply routing action if rule matched
      if (routingResult.matched && routingResult.action) {
        await this.applyRoutingAction(req, res, next, routingResult);
      } else {
        // No rule matched, continue with normal processing
        next();
      }
    } catch (error) {
      this.logger.error('Error in content routing middleware', error);
      next(error);
    }
  }

  /**
   * Applies the routing action based on the matched rule
   */
  private async applyRoutingAction(
    req: ExtendedRequest,
    res: Response,
    next: NextFunction,
    routingResult: any
  ): Promise<void> {
    const { action, transformedRequest } = routingResult;

    // Apply request transformations
    if (transformedRequest) {
      this.applyRequestTransformations(req, transformedRequest);
    }

    switch (action.type) {
      case RoutingActionType.FORWARD:
        await this.handleForward(req, res, next, action);
        break;

      case RoutingActionType.REDIRECT:
        await this.handleRedirect(req, res, action);
        break;

      case RoutingActionType.REWRITE:
        await this.handleRewrite(req, res, next, action);
        break;

      case RoutingActionType.BLOCK:
        await this.handleBlock(req, res, action);
        break;

      case RoutingActionType.RATE_LIMIT:
        await this.handleRateLimit(req, res, next, action);
        break;

      case RoutingActionType.CACHE:
        await this.handleCache(req, res, next, action);
        break;

      case RoutingActionType.TRANSFORM:
        await this.handleTransform(req, res, next, action);
        break;

      case RoutingActionType.CUSTOM_HANDLER:
        await this.handleCustom(req, res, next, action);
        break;

      default:
        this.logger.warn(`Unknown routing action type: ${action.type}`);
        next();
    }
  }

  /**
   * Handles FORWARD action - continues processing with modifications
   */
  private async handleForward(req: ExtendedRequest, res: Response, next: NextFunction, action: any): Promise<void> {
    if (action.target && action.target !== req.path) {
      // Modify the request path for internal forwarding
      req.url = req.url.replace(req.path, action.target);
      (req as any).path = action.target;
    }

    this.logger.debug(`Forwarding request to: ${action.target}`);
    next();
  }

  /**
   * Handles REDIRECT action - sends HTTP redirect response
   */
  private async handleRedirect(req: ExtendedRequest, res: Response, action: any): Promise<void> {
    const statusCode = action.parameters?.statusCode || 302;
    const target = this.interpolateTarget(action.target, req);
    
    this.logger.debug(`Redirecting request to: ${target} (${statusCode})`);
    res.redirect(statusCode, target);
  }

  /**
   * Handles REWRITE action - modifies request URL internally
   */
  private async handleRewrite(req: ExtendedRequest, res: Response, next: NextFunction, action: any): Promise<void> {
    const newPath = this.interpolateTarget(action.target, req);
    const originalPath = req.path;
    
    req.url = req.url.replace(originalPath, newPath);
    (req as any).path = newPath;
    
    this.logger.debug(`Rewriting request from ${originalPath} to: ${newPath}`);
    next();
  }

  /**
   * Handles BLOCK action - blocks the request with error response
   */
  private async handleBlock(req: ExtendedRequest, res: Response, action: any): Promise<void> {
    const statusCode = action.parameters?.statusCode || HttpStatus.FORBIDDEN;
    const message = action.parameters?.message || 'Access denied by routing rule';
    
    this.logger.warn(`Blocking request: ${req.method} ${req.path} - ${message}`);
    throw new HttpException(message, statusCode);
  }

  /**
   * Handles RATE_LIMIT action - applies additional rate limiting
   */
  private async handleRateLimit(req: ExtendedRequest, res: Response, next: NextFunction, action: any): Promise<void> {
    // This would integrate with your existing throttling system
    const limit = action.parameters?.limit || 10;
    const window = action.parameters?.window || 60000; // 1 minute
    
    // For now, just add headers and continue
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Window', window);
    
    this.logger.debug(`Applied rate limiting: ${limit} requests per ${window}ms`);
    next();
  }

  /**
   * Handles CACHE action - sets cache headers
   */
  private async handleCache(req: ExtendedRequest, res: Response, next: NextFunction, action: any): Promise<void> {
    const maxAge = action.parameters?.maxAge || 300; // 5 minutes
    const cacheControl = action.parameters?.cacheControl || `public, max-age=${maxAge}`;
    
    res.setHeader('Cache-Control', cacheControl);
    
    this.logger.debug(`Applied cache headers: ${cacheControl}`);
    next();
  }

  /**
   * Handles TRANSFORM action - applies custom transformations
   */
  private async handleTransform(req: ExtendedRequest, res: Response, next: NextFunction, action: any): Promise<void> {
    // Apply any additional transformations specified in the action
    if (action.parameters?.headers) {
      Object.entries(action.parameters.headers).forEach(([key, value]) => {
        req.headers[key.toLowerCase()] = value as string;
      });
    }

    if (action.parameters?.query) {
      Object.assign(req.query, action.parameters.query);
    }

    this.logger.debug('Applied custom transformations');
    next();
  }

  /**
   * Handles CUSTOM_HANDLER action - delegates to custom handler
   */
  private async handleCustom(req: ExtendedRequest, res: Response, next: NextFunction, action: any): Promise<void> {
    // This would allow for custom handler functions to be registered and called
    const handlerName = action.target;
    
    this.logger.debug(`Delegating to custom handler: ${handlerName}`);
    
    // For now, just continue - in a full implementation, you'd have a registry of custom handlers
    next();
  }

  /**
   * Applies request transformations from routing result
   */
  private applyRequestTransformations(req: ExtendedRequest, transformedRequest: any): void {
    if (transformedRequest.headers) {
      Object.assign(req.headers, transformedRequest.headers);
    }

    if (transformedRequest.query) {
      Object.assign(req.query, transformedRequest.query);
    }

    if (transformedRequest.path && transformedRequest.path !== req.path) {
      req.url = req.url.replace(req.path, transformedRequest.path);
      (req as any).path = transformedRequest.path;
    }
  }

  /**
   * Interpolates target string with request variables
   */
  private interpolateTarget(target: string, req: ExtendedRequest): string {
    return target
      .replace('${originalPath}', req.path)
      .replace('${method}', req.method)
      .replace('${host}', req.get('host') || '')
      .replace('${protocol}', req.protocol);
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
  private getClientIP(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }
}