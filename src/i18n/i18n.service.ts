import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { extname, join } from 'path';

/**
 * Languages written right-to-left, used as a fallback when a locale directory
 * does not ship a `_meta.json` file.  The authoritative source of direction for
 * any locale that *does* provide `_meta.json` is that file.
 */
const RTL_LANGS = ['ar', 'he', 'fa', 'ur'];

const DEFAULT_LOCALE = 'en';

/**
 * Shape of the optional `_meta.json` file that can be placed inside each
 * locale directory to supply display metadata.
 *
 * Example — `locales/ar/_meta.json`:
 * ```json
 * { "name": "Arabic", "direction": "rtl" }
 * ```
 */
interface LocaleMeta {
  name?: string;
  direction?: 'ltr' | 'rtl';
}

export interface LocaleDefinition {
  code: string;
  name: string;
  direction: 'ltr' | 'rtl';
}

@Injectable()
export class I18nWrapperService {
  private readonly logger = new Logger(I18nWrapperService.name);
  private readonly localesPath = join(__dirname, 'locales');
  private readonly fallbackLocale = DEFAULT_LOCALE;

  /**
   * Populated during construction by {@link loadBundles}.
   * Contains exactly one entry per locale whose directory was discovered and
   * whose bundle loaded without error — no more, no less.
   */
  private readonly supported: LocaleDefinition[] = [];

  /** Translation bundles keyed by locale code. */
  private readonly bundles: Record<string, Record<string, unknown>> = {};

  constructor() {
    this.loadBundles();
  }

  /**
   * Returns the set of locales whose bundles actually loaded at startup.
   * This is the authoritative list for language-picker endpoints.
   */
  getSupportedLocales(): LocaleDefinition[] {
    return this.supported;
  }

  getDirection(locale: string): 'ltr' | 'rtl' {
    return this.isRtl(locale) ? 'rtl' : 'ltr';
  }

  translate(key: string, locale: string): string {
    const normalized = this.normalizeLocale(locale);
    const bundle = this.bundles[normalized] ?? this.bundles[this.fallbackLocale] ?? {};
    return this.lookup(bundle, key) ?? key;
  }

  isRtl(locale: string): boolean {
    if (!locale) return false;
    return RTL_LANGS.includes(this.normalizeLocale(locale));
  }

  // ── Private ───────────────────────────────────────────────────────────────

  /**
   * Scans `localesPath` for subdirectories, loads every `*.json` file inside
   * each one as a named namespace (excluding `_meta.json`), and builds the
   * `supported` list from the directories that loaded successfully.
   *
   * `_meta.json` — if present — provides the display name and direction for
   * the locale.  If it is absent, direction falls back to {@link RTL_LANGS}
   * and the display name falls back to the uppercased locale code.
   */
  private loadBundles(): void {
    let localeDirs: string[];

    try {
      localeDirs = readdirSync(this.localesPath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
    } catch (err) {
      this.logger.error('Failed to read locales directory', err as Error);
      return;
    }

    for (const locale of localeDirs) {
      try {
        const localeFolder = join(this.localesPath, locale);
        const bundle: Record<string, unknown> = {};

        const files = readdirSync(localeFolder, { withFileTypes: true }).filter((e) => e.isFile());

        for (const file of files) {
          // _meta.json is metadata, not a translation namespace — skip it here.
          if (file.name === '_meta.json') continue;
          if (extname(file.name).toLowerCase() !== '.json') continue;

          const namespace = file.name.replace(/\.json$/i, '');
          const raw = readFileSync(join(localeFolder, file.name), 'utf8');
          bundle[namespace] = JSON.parse(raw) as Record<string, unknown>;
        }

        this.bundles[locale] = bundle;

        // Read optional metadata; fall back gracefully if absent or malformed.
        const meta = this.readMeta(localeFolder, locale);

        this.supported.push({
          code: locale,
          name: meta.name ?? locale.toUpperCase(),
          direction: meta.direction ?? (RTL_LANGS.includes(locale) ? 'rtl' : 'ltr'),
        });

        this.logger.debug(`Loaded locale bundle: ${locale}`);
      } catch (err) {
        // A broken bundle must not advertise the locale as supported.
        this.logger.error(`Failed to load locale bundle: ${locale}`, err as Error);
      }
    }
  }

  /**
   * Attempts to read and parse `_meta.json` from `localeFolder`.
   * Returns an empty object (causing fallbacks to apply) on any error.
   */
  private readMeta(localeFolder: string, locale: string): LocaleMeta {
    const metaPath = join(localeFolder, '_meta.json');
    if (!existsSync(metaPath)) return {};

    try {
      const raw = readFileSync(metaPath, 'utf8');
      return JSON.parse(raw) as LocaleMeta;
    } catch (err) {
      this.logger.warn(`Could not parse _meta.json for locale "${locale}"`, err as Error);
      return {};
    }
  }

  private normalizeLocale(locale: string): string {
    return String(locale).split(',')[0].split('-')[0].toLowerCase();
  }

  private lookup(bundle: Record<string, unknown>, key: string): string | undefined {
    const segments = key.split('.');
    let result: unknown = bundle;

    for (const segment of segments) {
      if (typeof result !== 'object' || result === null) return undefined;
      result = (result as Record<string, unknown>)[segment];
    }

    return typeof result === 'string' ? result : undefined;
  }
}
