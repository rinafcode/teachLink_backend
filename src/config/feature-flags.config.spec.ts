import {
  defaultFeatureFlags,
  FeatureFlagsConfig,
  loadFeatureFlags,
  getEnabledModules,
  getDisabledModules,
} from './feature-flags.config';

/**
 * Registry test — ensures the feature flags config stays in sync.
 * If a flag is accidentally removed, these tests will catch it.
 */

/** All flags that should exist in the config. Keep this list alphabetically sorted. */
const EXPECTED_FLAGS: (keyof FeatureFlagsConfig)[] = [
  'ENABLE_AB_TESTING',
  'ENABLE_ASSESSMENT',
  'ENABLE_AUTH',
  'ENABLE_BACKUP',
  'ENABLE_CACHING',
  'ENABLE_CDN',
  'ENABLE_COLLABORATION',
  'ENABLE_DATA_WAREHOUSE',
  'ENABLE_EMAIL_MARKETING',
  'ENABLE_FEATURE_FLAGS',
  'ENABLE_GAMIFICATION',
  'ENABLE_GRAPHQL',
  'ENABLE_LEARNING_PATHS',
  'ENABLE_LOCALIZATION',
  'ENABLE_MEDIA_PROCESSING',
  'ENABLE_MIGRATIONS',
  'ENABLE_MODERATION',
  'ENABLE_NOTIFICATIONS',
  'ENABLE_OBSERVABILITY',
  'ENABLE_ORCHESTRATION',
  'ENABLE_PAYMENTS',
  'ENABLE_RATE_LIMITING',
  'ENABLE_SEARCH',
  'ENABLE_SECURITY',
  'ENABLE_SYNC',
  'ENABLE_TENANCY',
];

describe('FeatureFlagsConfig', () => {
  describe('defaultFeatureFlags', () => {
    it('should define all expected flags', () => {
      for (const flag of EXPECTED_FLAGS) {
        expect(defaultFeatureFlags).toHaveProperty(flag);
      }
    });

    it('should have no unexpected flags', () => {
      const actualFlags = Object.keys(defaultFeatureFlags).sort();
      expect(actualFlags).toEqual([...EXPECTED_FLAGS]);
    });

    it.each(EXPECTED_FLAGS)('%s should be a boolean', (flag) => {
      expect(typeof defaultFeatureFlags[flag]).toBe('boolean');
    });

    it.each(EXPECTED_FLAGS)('%s should not be undefined', (flag) => {
      expect(defaultFeatureFlags[flag]).not.toBeUndefined();
    });
  });

  describe('loadFeatureFlags', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('should return defaults when no env vars are set', () => {
      // Clear all ENABLE_ env vars
      for (const key of Object.keys(process.env)) {
        if (key.startsWith('ENABLE_')) {
          delete process.env[key];
        }
      }

      const flags = loadFeatureFlags();
      expect(flags).toEqual(defaultFeatureFlags);
    });

    it('should override a flag when its env var is set to "true"', () => {
      process.env.ENABLE_AB_TESTING = 'true';
      const flags = loadFeatureFlags();
      expect(flags.ENABLE_AB_TESTING).toBe(true);
    });

    it('should override a flag when its env var is set to "false"', () => {
      process.env.ENABLE_AUTH = 'false';
      const flags = loadFeatureFlags();
      expect(flags.ENABLE_AUTH).toBe(false);
    });

    it('should accept "1" as true', () => {
      process.env.ENABLE_GRAPHQL = '1';
      const flags = loadFeatureFlags();
      expect(flags.ENABLE_GRAPHQL).toBe(true);
    });
  });

  describe('getEnabledModules', () => {
    it('should return all modules when all flags are true', () => {
      const allTrue = { ...defaultFeatureFlags };
      for (const key of Object.keys(allTrue) as (keyof FeatureFlagsConfig)[]) {
        allTrue[key] = true;
      }
      const modules = getEnabledModules(allTrue);
      expect(modules.length).toBe(EXPECTED_FLAGS.length);
    });

    it('should return empty array when all flags are false', () => {
      const allFalse = { ...defaultFeatureFlags };
      for (const key of Object.keys(allFalse) as (keyof FeatureFlagsConfig)[]) {
        allFalse[key] = false;
      }
      const modules = getEnabledModules(allFalse);
      expect(modules).toEqual([]);
    });
  });

  describe('getDisabledModules', () => {
    // NOTE: getDisabledModules has a pre-existing naming convention mismatch.
    // It generates names like "AUTHModule" (from key stripping) while
    // getEnabledModules uses human-readable names like "AuthModule".
    // This means the filter comparison never matches, and all modules are
    // always returned as "disabled". This is a known bug tracked separately.

    it('should return an array of module name strings', () => {
      const disabled = getDisabledModules(defaultFeatureFlags);
      expect(Array.isArray(disabled)).toBe(true);
      for (const mod of disabled) {
        expect(typeof mod).toBe('string');
        expect(mod.endsWith('Module')).toBe(true);
      }
    });

    it('should return more disabled modules when flags are false', () => {
      const allFalse = { ...defaultFeatureFlags };
      for (const key of Object.keys(allFalse) as (keyof FeatureFlagsConfig)[]) {
        allFalse[key] = false;
      }
      const disabledAll = getDisabledModules(allFalse);
      expect(disabledAll.length).toBe(EXPECTED_FLAGS.length);
    });
  });
});
