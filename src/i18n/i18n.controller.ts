import { Controller, Get, Query } from '@nestjs/common';
import { I18nWrapperService } from './i18n.service';

@Controller('i18n')
export class I18nController {
  constructor(private readonly i18n: I18nWrapperService) {}

  @Get('locales')
  getLocales() {
    return this.i18n.getSupportedLocales();
  }

  @Get('translate')
  translate(@Query('key') key: string, @Query('lang') lang?: string) {
    if (!key) return { error: 'missing_key' };
    const locale = lang || 'en';
    const value = this.i18n.translate(key, locale);
    const direction = this.i18n.getDirection(locale);
    return { key, locale, value, direction };
  }
}
