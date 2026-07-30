import {
  DEFAULT_EXPLAIN_THRESHOLD_MS,
  DEFAULT_SLOW_QUERY_THRESHOLD_MS,
  SlowQueryLogger,
  SlowQueryLoggerOptions,
  resolveSlowQueryLoggerOptions,
} from './slow-query.logger';

/** Lets the un-awaited EXPLAIN ANALYZE promise settle before assertions. */
const flushAsync = () => new Promise((resolve) => setImmediate(resolve));

describe('resolveSlowQueryLoggerOptions', () => {
  it('falls back to documented defaults when nothing is configured', () => {
    const options = resolveSlowQueryLoggerOptions({} as NodeJS.ProcessEnv);

    expect(options.slowQueryThresholdMs).toBe(DEFAULT_SLOW_QUERY_THRESHOLD_MS);
    expect(options.explainThresholdMs).toBe(DEFAULT_EXPLAIN_THRESHOLD_MS);
    expect(options.enabled).toBe(true);
  });

  it('reads overrides from the environment', () => {
    const options = resolveSlowQueryLoggerOptions({
      DB_SLOW_QUERY_THRESHOLD_MS: '250',
      DB_EXPLAIN_THRESHOLD_MS: '1000',
    } as NodeJS.ProcessEnv);

    expect(options.slowQueryThresholdMs).toBe(250);
    expect(options.explainThresholdMs).toBe(1000);
  });

  it('ignores values that are not positive integers', () => {
    const options = resolveSlowQueryLoggerOptions({
      DB_SLOW_QUERY_THRESHOLD_MS: 'not-a-number',
      DB_EXPLAIN_THRESHOLD_MS: '-5',
    } as NodeJS.ProcessEnv);

    expect(options.slowQueryThresholdMs).toBe(DEFAULT_SLOW_QUERY_THRESHOLD_MS);
    expect(options.explainThresholdMs).toBe(DEFAULT_EXPLAIN_THRESHOLD_MS);
  });

  it('disables itself in test environments', () => {
    const options = resolveSlowQueryLoggerOptions({ NODE_ENV: 'test' } as NodeJS.ProcessEnv);

    expect(options.enabled).toBe(false);
  });
});

describe('SlowQueryLogger', () => {
  const options: SlowQueryLoggerOptions = {
    slowQueryThresholdMs: 500,
    explainThresholdMs: 2000,
    enabled: true,
  };

  const createQueryRunner = () => ({ query: jest.fn().mockResolvedValue([]) });

  it('runs EXPLAIN ANALYZE for slow reads past the explain threshold', async () => {
    const queryRunner = createQueryRunner();

    new SlowQueryLogger(options).logQuerySlow(
      2500,
      'SELECT * FROM users',
      [],
      queryRunner as never,
    );
    await flushAsync();

    expect(queryRunner.query).toHaveBeenCalledWith('EXPLAIN ANALYZE SELECT * FROM users', []);
  });

  it('leaves queries between the two thresholds unexplained', async () => {
    const queryRunner = createQueryRunner();

    new SlowQueryLogger(options).logQuerySlow(900, 'SELECT * FROM users', [], queryRunner as never);
    await flushAsync();

    expect(queryRunner.query).not.toHaveBeenCalled();
  });

  it('never re-executes a write statement under EXPLAIN ANALYZE', async () => {
    const queryRunner = createQueryRunner();

    new SlowQueryLogger(options).logQuerySlow(
      5000,
      'UPDATE users SET name = $1',
      ['teachlink'],
      queryRunner as never,
    );
    await flushAsync();

    expect(queryRunner.query).not.toHaveBeenCalled();
  });

  it('does not recurse when the statement is already an EXPLAIN', async () => {
    const queryRunner = createQueryRunner();

    new SlowQueryLogger(options).logQuerySlow(
      5000,
      'EXPLAIN ANALYZE SELECT * FROM users',
      [],
      queryRunner as never,
    );
    await flushAsync();

    expect(queryRunner.query).not.toHaveBeenCalled();
  });

  it('swallows EXPLAIN ANALYZE failures', async () => {
    const queryRunner = { query: jest.fn().mockRejectedValue(new Error('boom')) };

    expect(() =>
      new SlowQueryLogger(options).logQuerySlow(
        5000,
        'SELECT * FROM users',
        [],
        queryRunner as never,
      ),
    ).not.toThrow();
    await flushAsync();

    expect(queryRunner.query).toHaveBeenCalled();
  });

  it('emits nothing at all when disabled', async () => {
    const queryRunner = createQueryRunner();

    new SlowQueryLogger({ ...options, enabled: false }).logQuerySlow(
      5000,
      'SELECT * FROM users',
      [],
      queryRunner as never,
    );
    await flushAsync();

    expect(queryRunner.query).not.toHaveBeenCalled();
  });
});
