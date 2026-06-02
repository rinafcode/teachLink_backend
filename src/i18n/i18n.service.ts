import { Injectable, Logger } from '@nestjs/common';
import { readdirSync, readFileSync } from 'fs';
import { extname, join } from 'path';

const RTL_LANGS = ['ar', 'he', 'fa', 'ur'];
const DEFAULT_LOCALE = 'en';

interface LocaleDefinition {
  code: string;
  name: string;
  direction: 'ltr' | 'rtl';
}

@Injectable()
export class I18nWrapperService {
  private readonly logger = new Logger(I18nWrapperService.name);
  private readonly localesPath = join(__dirname, 'locales');
  private readonly fallbackLocale = DEFAULT_LOCALE;
  private readonly supported: LocaleDefinition[] = [
    { code: 'en', name: 'English', direction: 'ltr' },
    { code: 'ar', name: 'Arabic', direction: 'rtl' },
  ];
  private readonly bundles: Record<string, Record<string, unknown>> = {};

  constructor() {
    this.loadBundles();
  }

  getSupportedLocales() {
    return this.supported;
  }

  getDirection(locale: string) {
    return this.isRtl(locale) ? 'rtl' : 'ltr';
  }

  translate(key: string, locale: string) {
    const normalized = this.normalizeLocale(locale);
    const bundle = this.bundles[normalized] || this.bundles[this.fallbackLocale] || {};
    return this.lookup(bundle, key) ?? key;
  }

  isRtl(locale: string) {
    if (!locale) return false;
    return RTL_LANGS.includes(this.normalizeLocale(locale));
  }

  private loadBundles() {
    try {
      const localeDirs = readdirSync(this.localesPath, { withFileTypes: true }).filter((entry) => entry.isDirectory());
      for (const localeDir of localeDirs) {
        const locale = localeDir.name;
        const bundle: Record<string, unknown> = {};
        const localeFolder = join(this.localesPath, locale);
        const files = readdirSync(localeFolder, { withFileTypes: true }).filter((entry) => entry.isFile());

        for (const file of files) {
          if (extname(file.name).toLowerCase() !== '.json') continue;
          const namespace = file.name.replace(/\.json$/i, '');
          const raw = readFileSync(join(localeFolder, file.name), 'utf8');
          bundle[namespace] = JSON.parse(raw);
        }

        this.bundles[locale] = bundle;
      }
    } catch (error) {
      this.logger.error('Failed to load locale bundles', error as Error);
    }
  }

  private normalizeLocale(locale: string) {
    return String(locale).split(',')[0].split('-')[0].toLowerCase();
  }

  private lookup(bundle: Record<string, unknown>, key: string): string | undefined {
    const segments = key.split('.');
    let result: unknown = bundle;

    for (const segment of segments) {
      if (typeof result !== 'object' || result === null) {
        return undefined;
      }
      result = (result as Record<string, unknown>)[segment];
    }

    return typeof result === 'string' ? result : undefined;
  }
}
