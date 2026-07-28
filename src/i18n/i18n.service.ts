import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readdir, readFile } from 'fs/promises';
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
export class I18nWrapperService implements OnModuleInit {
  private readonly logger = new Logger(I18nWrapperService.name);
  private readonly localesPath = join(__dirname, 'locales');
  private readonly fallbackLocale = DEFAULT_LOCALE;

  /**
   * Populated during {@link onModuleInit} by {@link loadBundles}.
   * Contains exactly one entry per locale whose directory was discovered and
   * whose bundle loaded without error — no more, no less.
   */
  private readonly supported: LocaleDefinition[] = [];

  /** Translation bundles keyed by locale code. */
  private readonly bundles: Record<string, Record<string, unknown>> = {};

  /**
   * Locale bundles are loaded here — through the module lifecycle — rather than
   * in the constructor.  This keeps all filesystem access asynchronous and
   * ensures a missing or empty locales directory fails startup loudly instead
   * of silently degrading every translation to a key passthrough.
   */
  async onModuleInit(): Promise<void> {
    await this.loadBundles();
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
   *
   * Startup fails (this method throws) when the locales directory cannot be
   * read, is empty, or yields no loadable bundle — the caller
   * ({@link onModuleInit}) surfaces the error so the application does not boot
   * into a state where every translation silently falls through to its key.
   */
  private async loadBundles(): Promise<void> {
    let localeDirs: string[];

    try {
      const entries = await readdir(this.localesPath, { withFileTypes: true });
      localeDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    } catch (err) {
      throw new Error(
        `i18n: unable to read locales directory at "${this.localesPath}". ` +
          'The production build must ship the locale bundles (see nest-cli.json "assets"). ' +
          `Underlying error: ${(err as Error).message}`,
      );
    }

    if (localeDirs.length === 0) {
      throw new Error(
        `i18n: locales directory at "${this.localesPath}" is empty. ` +
          'The production build must ship the locale bundles (see nest-cli.json "assets").',
      );
    }

    for (const locale of localeDirs) {
      try {
        const localeFolder = join(this.localesPath, locale);
        const bundle: Record<string, unknown> = {};

        const entries = await readdir(localeFolder, { withFileTypes: true });
        const files = entries.filter((e) => e.isFile());

        for (const file of files) {
          // _meta.json is metadata, not a translation namespace — skip it here.
          if (file.name === '_meta.json') continue;
          if (extname(file.name).toLowerCase() !== '.json') continue;

          const namespace = file.name.replace(/\.json$/i, '');
          const raw = await readFile(join(localeFolder, file.name), 'utf8');
          bundle[namespace] = JSON.parse(raw) as Record<string, unknown>;
        }

        this.bundles[locale] = bundle;

        // Read optional metadata; fall back gracefully if absent or malformed.
        const meta = await this.readMeta(localeFolder, locale);

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

    if (this.supported.length === 0) {
      throw new Error(
        `i18n: found locale directories under "${this.localesPath}" but none produced a ` +
          'loadable bundle. Refusing to start with translations degraded to key passthrough.',
      );
    }
  }

  /**
   * Attempts to read and parse `_meta.json` from `localeFolder`.
   * Returns an empty object (causing fallbacks to apply) when the file is
   * absent or cannot be parsed.
   */
  private async readMeta(localeFolder: string, locale: string): Promise<LocaleMeta> {
    const metaPath = join(localeFolder, '_meta.json');

    let raw: string;
    try {
      raw = await readFile(metaPath, 'utf8');
    } catch (err) {
      // A missing _meta.json is expected (it is optional); only surface other errors.
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Could not read _meta.json for locale "${locale}"`, err as Error);
      }
      return {};
    }

    try {
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
