export const I18N_CACHE_KEY_PREFIX = 'i18n:ns:';

export function bundleCacheKey(namespace: string, locale: string): string {
  return `${I18N_CACHE_KEY_PREFIX}${namespace}:${locale}`;
}
