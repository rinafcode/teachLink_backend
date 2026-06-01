import { Injectable, NestMiddleware } from '@nestjs/common';
import { RateLimitExceededException } from '../../common/exceptions/app.exceptions';
import { Request, Response, NextFunction } from 'express';

const hits = new Map<string, { count: number; reset: number }>();
const LIMIT = 100;
const WINDOW_MS = 60_000;

@Injectable()
export class ThrottleMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const key =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ?? req.ip ?? 'unknown';
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || now > entry.reset) {
      hits.set(key, { count: 1, reset: now + WINDOW_MS });
      return next();
    }
    if (entry.count >= LIMIT) {
      res.setHeader('Retry-After', Math.ceil((entry.reset - now) / 1000));
      throw new RateLimitExceededException(Math.ceil((entry.reset - now) / 1000));
    }
    entry.count++;
    next();
  }
}
