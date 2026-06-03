import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { I18nWrapperService } from './i18n.service';
import { RequestWithLocale } from '../common/types/request-with-locale';

@Injectable()
export class LocaleMiddleware implements NestMiddleware {
  constructor(private readonly wrapper: I18nWrapperService) {}

  use(req: RequestWithLocale, res: Response, next: NextFunction) {
    const lang = (req.query.lang as string) || (req.headers['x-lang'] as string) || (req.headers['lang'] as string) || 'en';
    const short = String(lang).split(',')[0].split('-')[0];
    const direction = this.wrapper.getDirection(short);
    res.setHeader('Content-Direction', direction);
    req.resolvedLocale = short;
    next();
  }
}
