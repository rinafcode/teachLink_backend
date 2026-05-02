export const I18N_CACHE_KEY_PREFIX = 'i18n:ns:';

/**
 * Executes bundle Cache Key.
 * @param namespace The namespace.
 * @param locale The locale.
 * @returns The resulting string value.
 */
export function bundleCacheKey(namespace: string, locale: string): string {
    return `${I18N_CACHE_KEY_PREFIX}${namespace}:${locale}`;
}
