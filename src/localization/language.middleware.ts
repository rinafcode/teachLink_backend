import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Response } from 'express';
import { RequestWithLocale } from '../common/types/request-with-locale';
import { LanguageDetectionService } from './language-detection.service';

/**
 * Applies language middleware behavior.
 */
@Injectable()
export class LanguageMiddleware implements NestMiddleware {
  constructor(private readonly languageDetection: LanguageDetectionService) {}

  /**
   * Executes use.
   * @param req The req.
   * @param _res The res.
   * @param next The next.
   */
  use(req: RequestWithLocale, _res: Response, next: NextFunction): void {
    const raw = req.query?.lang;
    const queryLang =
      typeof raw === 'string'
        ? raw
        : Array.isArray(raw) && typeof raw[0] === 'string'
          ? raw[0]
          : undefined;
    req.resolvedLocale = this.languageDetection.resolveLocale(req, queryLang);
    next();
  }
}
