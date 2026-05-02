import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { CsrfService } from '../csrf/csrf.service';

/**
 * Applies csrf middleware behavior.
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  constructor(
    private csrfService: CsrfService,
    private configService: ConfigService,
  ) {}

  /**
   * Executes use.
   * @param req The req.
   * @param res The res.
   * @param next The next.
   */
  use(req: Request, res: Response, next: NextFunction): void {
    // Skip CSRF for GET, HEAD, OPTIONS requests
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      this.generateCsrfToken(req, res);
      return next();
    }
    private generateCsrfToken(req: Request, res: Response): void {
        const sessionId = this.getSessionId(req);
        const existingToken = this.csrfService.getToken(sessionId);
        if (existingToken) {
            res.setHeader('X-CSRF-Token', existingToken);
            (req as unknown).csrfToken = existingToken;
            return;
        }
        // Generate new token
        const token = this.csrfService.generateToken(sessionId);
        res.setHeader('X-CSRF-Token', token);
        (req as unknown).csrfToken = token;
    }
    private validateCsrfToken(req: Request): void {
        const sessionId = this.getSessionId(req);
        const tokenFromHeader = req.headers['x-csrf-token'] as string;
        const tokenFromBody = req.body?._csrf;
        const submittedToken = tokenFromHeader || tokenFromBody;
        if (!submittedToken || !this.csrfService.validateToken(sessionId, submittedToken)) {
            throw new UnauthorizedException('Invalid CSRF token');
        }
    }
    private getSessionId(req: Request): string {
        // Try to get session ID from session
        if ((req as unknown).session?.id) {
            return (req as unknown).session.id;
        }
        // Fallback to IP address (less secure, but better than nothing)
        return req.ip || req.connection.remoteAddress || 'unknown';
    }
}
