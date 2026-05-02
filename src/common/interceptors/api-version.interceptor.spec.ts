import { isVersionNeutralPath, normalizeRequestedApiVersion, parseSupportedApiVersions, } from './api-version.interceptor';
describe('api version helpers', () => {
    it('normalizes supported version formats', () => {
        expect(normalizeRequestedApiVersion('1')).toBe('1');
        expect(normalizeRequestedApiVersion('v1')).toBe('1');
        expect(normalizeRequestedApiVersion('1.0')).toBe('1');
        expect(normalizeRequestedApiVersion('v1.0')).toBe('1');
    });
    it('rejects invalid version formats', () => {
        expect(normalizeRequestedApiVersion('latest')).toBeNull();
        expect(normalizeRequestedApiVersion('v1.2')).toBeNull();
        expect(normalizeRequestedApiVersion(undefined)).toBeNull();
    });
    it('parses configured supported versions', () => {
        expect(parseSupportedApiVersions('1, v1, 2')).toEqual(['1', '2']);
    });
    it('detects version-neutral routes', () => {
        expect(isVersionNeutralPath('/')).toBe(true);
        expect(isVersionNeutralPath('/health')).toBe(true);
        expect(isVersionNeutralPath('/metrics/scheduled-tasks/dashboard')).toBe(true);
        expect(isVersionNeutralPath('/webhooks/stripe')).toBe(true);
        expect(isVersionNeutralPath('/users')).toBe(false);
    });
});
