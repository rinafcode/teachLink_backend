import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { I18nWrapperService } from './i18n.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a temporary locales root and returns helpers to populate it. */
function makeTmpLocalesDir() {
  const root = mkdtempSync(join(tmpdir(), 'i18n-test-'));

  function addLocale(
    code: string,
    bundles: Record<string, Record<string, unknown>>,
    meta?: { name?: string; direction?: 'ltr' | 'rtl' },
  ) {
    const dir = join(root, code);
    mkdirSync(dir, { recursive: true });

    for (const [ns, content] of Object.entries(bundles)) {
      writeFileSync(join(dir, `${ns}.json`), JSON.stringify(content));
    }

    if (meta !== undefined) {
      writeFileSync(join(dir, '_meta.json'), JSON.stringify(meta));
    }
  }

  function addBrokenLocale(code: string) {
    const dir = join(root, code);
    mkdirSync(dir, { recursive: true });
    // Write invalid JSON so bundle parsing throws.
    writeFileSync(join(dir, 'common.json'), '{ INVALID JSON }');
  }

  return { root, addLocale, addBrokenLocale };
}

/** Builds an I18nWrapperService pointed at a custom locales path and loads bundles. */
async function makeService(localesPath: string): Promise<I18nWrapperService> {
  const svc = new I18nWrapperService();
  // Override the private localesPath and trigger the lifecycle hook manually.
  (svc as any).localesPath = localesPath;
  (svc as any).supported.length = 0;
  Object.keys((svc as any).bundles).forEach((k) => delete (svc as any).bundles[k]);
  await svc.onModuleInit();
  return svc;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('I18nWrapperService', () => {
  let root: string;
  let addLocale: ReturnType<typeof makeTmpLocalesDir>['addLocale'];
  let addBrokenLocale: ReturnType<typeof makeTmpLocalesDir>['addBrokenLocale'];

  beforeEach(() => {
    ({ root, addLocale, addBrokenLocale } = makeTmpLocalesDir());
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  // ── getSupportedLocales matches loaded bundles ──────────────────────────

  describe('getSupportedLocales()', () => {
    it('returns only the locales whose bundles loaded successfully', async () => {
      addLocale('en', { common: { greeting: 'Hello' } }, { name: 'English', direction: 'ltr' });
      addLocale('ar', { common: { greeting: 'مرحبا' } }, { name: 'Arabic', direction: 'rtl' });

      const svc = await makeService(root);
      const codes = svc.getSupportedLocales().map((l) => l.code);

      expect(codes).toHaveLength(2);
      expect(codes).toContain('en');
      expect(codes).toContain('ar');
    });

    it('excludes a locale whose bundle file contains invalid JSON', async () => {
      addLocale('en', { common: { greeting: 'Hello' } }, { name: 'English', direction: 'ltr' });
      addBrokenLocale('fr');

      const svc = await makeService(root);
      const codes = svc.getSupportedLocales().map((l) => l.code);

      expect(codes).toHaveLength(1);
      expect(codes).toContain('en');
      expect(codes).not.toContain('fr');
    });

    it('throws when no locale directories exist (fail-fast)', async () => {
      await expect(makeService(root)).rejects.toThrow(/is empty/);
    });

    it('throws when locales directory is missing', async () => {
      const missing = join(tmpdir(), `i18n-test-missing-${Date.now()}`);
      await expect(makeService(missing)).rejects.toThrow(/unable to read locales directory/);
    });

    it('throws when locale directories exist but none produce a loadable bundle', async () => {
      addBrokenLocale('fr');
      addBrokenLocale('de');

      await expect(makeService(root)).rejects.toThrow(/none produced a loadable bundle/);
    });
  });

  // ── Adding a new bundle makes the locale appear automatically ────────────

  describe('new locale discovery', () => {
    it('advertises a newly added locale without any service code change', async () => {
      addLocale('en', { common: { greeting: 'Hello' } }, { name: 'English', direction: 'ltr' });
      addLocale('es', { common: { greeting: 'Hola' } }, { name: 'Spanish', direction: 'ltr' });

      const svc = await makeService(root);
      const codes = svc.getSupportedLocales().map((l) => l.code);

      expect(codes).toContain('es');
    });

    it('reports the correct direction for the newly added locale', async () => {
      addLocale('es', { common: { greeting: 'Hola' } }, { name: 'Spanish', direction: 'ltr' });

      const svc = await makeService(root);
      const es = svc.getSupportedLocales().find((l) => l.code === 'es');

      expect(es).toBeDefined();
      expect(es!.direction).toBe('ltr');
    });

    it('reports the correct name for the newly added locale', async () => {
      addLocale('es', { common: { greeting: 'Hola' } }, { name: 'Spanish', direction: 'ltr' });

      const svc = await makeService(root);
      const es = svc.getSupportedLocales().find((l) => l.code === 'es');

      expect(es!.name).toBe('Spanish');
    });
  });

  // ── Direction is correct for every advertised locale ────────────────────

  describe('direction metadata', () => {
    it('reads direction from _meta.json when present', async () => {
      addLocale('ar', { common: { greeting: 'مرحبا' } }, { name: 'Arabic', direction: 'rtl' });

      const svc = await makeService(root);
      const ar = svc.getSupportedLocales().find((l) => l.code === 'ar');

      expect(ar!.direction).toBe('rtl');
    });

    it('falls back to RTL_LANGS inference when _meta.json is absent', async () => {
      // ar is in RTL_LANGS — no _meta.json provided.
      addLocale('ar', { common: { greeting: 'مرحبا' } });

      const svc = await makeService(root);
      const ar = svc.getSupportedLocales().find((l) => l.code === 'ar');

      expect(ar!.direction).toBe('rtl');
    });

    it('falls back to ltr when locale is not in RTL_LANGS and _meta.json is absent', async () => {
      addLocale('fr', { common: { greeting: 'Bonjour' } });

      const svc = await makeService(root);
      const fr = svc.getSupportedLocales().find((l) => l.code === 'fr');

      expect(fr!.direction).toBe('ltr');
    });

    it('uses uppercased code as name when _meta.json is absent', async () => {
      addLocale('fr', { common: { greeting: 'Bonjour' } });

      const svc = await makeService(root);
      const fr = svc.getSupportedLocales().find((l) => l.code === 'fr');

      expect(fr!.name).toBe('FR');
    });

    it('does not include _meta as a translation namespace', async () => {
      addLocale('en', { common: { greeting: 'Hello' } }, { name: 'English', direction: 'ltr' });

      const svc = await makeService(root);
      // _meta should not appear as a translation key.
      const result = svc.translate('_meta.name', 'en');
      // Falls back to the key itself when the namespace doesn't exist.
      expect(result).toBe('_meta.name');
    });
  });

  // ── translate() still works after refactor ───────────────────────────────

  describe('translate()', () => {
    it('returns the translated string for a loaded bundle', async () => {
      addLocale('en', { common: { greeting: 'Hello' } }, { name: 'English', direction: 'ltr' });

      const svc = await makeService(root);
      expect(svc.translate('common.greeting', 'en')).toBe('Hello');
    });

    it('falls back to the fallback locale when requested locale is not loaded', async () => {
      addLocale('en', { common: { greeting: 'Hello' } }, { name: 'English', direction: 'ltr' });

      const svc = await makeService(root);
      expect(svc.translate('common.greeting', 'de')).toBe('Hello');
    });

    it('returns the key when neither the locale nor the fallback has it', async () => {
      addLocale('en', { common: { greeting: 'Hello' } }, { name: 'English', direction: 'ltr' });

      const svc = await makeService(root);
      expect(svc.translate('common.missing_key', 'en')).toBe('common.missing_key');
    });
  });
});
