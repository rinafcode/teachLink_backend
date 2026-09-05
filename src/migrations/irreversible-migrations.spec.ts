import { QueryRunner } from 'typeorm';
import { EnableUuidOssp1600000000000 } from './1600000000000-enable-uuid-ossp';
import { ClearPlaintextAuthTokens1783000000000 } from './1783000000000-clear-plaintext-auth-tokens';
import { ReencryptOAuthProviderTokens1783000000001 } from './1783000000001-reencrypt-oauth-provider-tokens';
import { ClearLegacyBcryptRefreshTokens1783000000006 } from './1783000000006-clear-legacy-bcrypt-refresh-tokens';
import { AddPausedSubscriptionStatus1790000000000 } from './1790000000000-add-paused-subscription-status';
import { FixInvoiceNumberSequence1790000000001 } from './1790000000001-fix-invoice-number-sequence';
import { FixForumAnonymousAuthor1791000000001 } from './1791000000001-fix-forum-anonymous-author';

/**
 * Issue #1207 — Irreversible data migrations and no-op rollbacks must log a loud warning
 * on down() so migration:revert output is honest in CI, incident response, and local workflows.
 */
describe('Irreversible migrations down() loud warnings (Issue #1207)', () => {
  let warnSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;
  let mockQueryRunner: jest.Mocked<QueryRunner>;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockQueryRunner = {
      query: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<QueryRunner>;
  });

  afterEach(() => {
    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('1600000000000-enable-uuid-ossp logs a loud warning in down()', async () => {
    const migration = new EnableUuidOssp1600000000000();
    await migration.down(mockQueryRunner);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/WARNING:.*uuid-ossp/i);
  });

  it('1783000000000-clear-plaintext-auth-tokens logs a loud warning in down()', async () => {
    const migration = new ClearPlaintextAuthTokens1783000000000();
    await migration.down(mockQueryRunner);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/WARNING:.*plaintext.*token/i);
  });

  it('1783000000001-reencrypt-oauth-provider-tokens logs a loud warning in down()', async () => {
    const migration = new ReencryptOAuthProviderTokens1783000000001();
    await migration.down(mockQueryRunner);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/WARNING:.*OAuth/i);
  });

  it('1783000000006-clear-legacy-bcrypt-refresh-tokens logs a loud warning in down()', async () => {
    const migration = new ClearLegacyBcryptRefreshTokens1783000000006();
    await migration.down(mockQueryRunner);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/WARNING:.*bcrypt/i);
  });

  it('1790000000000-add-paused-subscription-status logs a loud warning in down()', async () => {
    const migration = new AddPausedSubscriptionStatus1790000000000();
    await migration.down(mockQueryRunner);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/WARNING:.*enum/i);
  });

  it('1790000000001-fix-invoice-number-sequence logs a loud warning in down()', async () => {
    const migration = new FixInvoiceNumberSequence1790000000001();
    await migration.down(mockQueryRunner);

    const loggedWarnings = warnSpy.mock.calls.some(([msg]) =>
      typeof msg === 'string' && msg.includes('WARNING: Down migration cannot recover original timestamp'),
    );
    expect(loggedWarnings).toBe(true);
  });

  it('1791000000001-fix-forum-anonymous-author logs a loud warning in down()', async () => {
    const migration = new FixForumAnonymousAuthor1791000000001();
    await migration.down(mockQueryRunner);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/WARNING:.*forum.*vote/i);
  });
});
