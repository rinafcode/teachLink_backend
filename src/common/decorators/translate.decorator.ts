import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestWithLocale } from '../types/request-with-locale';

/**
 * Resolved request locale when LanguageMiddleware runs (Accept-Language / ?lang=).
 * Falls back to I18N_DEFAULT_LOCALE or the decorator argument when unset.
 */
export const CurrentLocale = createParamDecorator(
  (fallbackLocale: string | undefined, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<RequestWithLocale>();
    const envDefault = (process.env.I18N_DEFAULT_LOCALE || 'en').trim().toLowerCase();
    return req.resolvedLocale ?? fallbackLocale ?? envDefault;
  },
);
