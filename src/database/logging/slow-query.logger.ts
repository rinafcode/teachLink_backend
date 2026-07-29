import { Logger as NestLogger } from '@nestjs/common';
import { Logger as TypeOrmLogger, QueryRunner } from 'typeorm';

export const DEFAULT_SLOW_QUERY_THRESHOLD_MS = 500;
export const DEFAULT_EXPLAIN_THRESHOLD_MS = 2000;

/** Maximum number of characters of SQL retained in a single log line. */
const MAX_LOGGED_QUERY_LENGTH = 2000;

export interface SlowQueryLoggerOptions {
  /** Queries at or above this duration are logged. */
  slowQueryThresholdMs: number;
  /** Queries at or above this duration additionally get EXPLAIN ANALYZE. */
  explainThresholdMs: number;
  /** When false the logger becomes a no-op (used to silence test runs). */
  enabled: boolean;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Reads slow-query logging configuration from the environment, falling back to
 * documented defaults when a variable is missing or not a positive integer.
 *
 * The logger is disabled under `NODE_ENV=test` so unit and e2e runs are not
 * polluted with timing noise.
 */
export function resolveSlowQueryLoggerOptions(
  env: NodeJS.ProcessEnv = process.env,
): SlowQueryLoggerOptions {
  return {
    slowQueryThresholdMs: parsePositiveInt(
      env.DB_SLOW_QUERY_THRESHOLD_MS,
      DEFAULT_SLOW_QUERY_THRESHOLD_MS,
    ),
    explainThresholdMs: parsePositiveInt(
      env.DB_EXPLAIN_THRESHOLD_MS,
      DEFAULT_EXPLAIN_THRESHOLD_MS,
    ),
    enabled: env.NODE_ENV !== 'test',
  };
}

/**
 * TypeORM logger that surfaces slow queries in the application's own
 * structured logs, so a slow query can be correlated with the request trace
 * that produced it without reaching for an external APM.
 *
 * TypeORM invokes `logQuerySlow` only for queries slower than the connection's
 * `maxQueryExecutionTime`, which `database.config.ts` wires to
 * `slowQueryThresholdMs`.
 */
export class SlowQueryLogger implements TypeOrmLogger {
  private readonly logger = new NestLogger(SlowQueryLogger.name);

  constructor(
    private readonly options: SlowQueryLoggerOptions = resolveSlowQueryLoggerOptions(),
  ) {}

  /**
   * Emits one structured line per slow query and, past the explain threshold,
   * schedules an EXPLAIN ANALYZE for the same statement.
   */
  logQuerySlow(
    time: number,
    query: string,
    parameters?: unknown[],
    queryRunner?: QueryRunner,
  ): void {
    if (!this.options.enabled) {
      return;
    }

    this.logger.warn(
      JSON.stringify({
        event: 'db.slow_query',
        durationMs: time,
        thresholdMs: this.options.slowQueryThresholdMs,
        query: this.truncate(query),
        parameters: this.describeParameters(parameters),
      }),
    );

    if (time >= this.options.explainThresholdMs) {
      // Deliberately not awaited: the query has already returned to the
      // caller and diagnostics must not extend the request lifetime.
      void this.explainAnalyze(time, query, parameters, queryRunner);
    }
  }

  /**
   * Runs EXPLAIN ANALYZE for a statement that breached the explain threshold
   * and appends the plan to the structured log.
   *
   * EXPLAIN ANALYZE genuinely executes the statement it wraps, so this is
   * restricted to read-only statements -- profiling a write would duplicate
   * it. Failures are swallowed: diagnostics must never surface as an error.
   */
  private async explainAnalyze(
    time: number,
    query: string,
    parameters?: unknown[],
    queryRunner?: QueryRunner,
  ): Promise<void> {
    if (!queryRunner || !this.isSafeToExplain(query)) {
      return;
    }

    try {
      const plan = await queryRunner.query(`EXPLAIN ANALYZE ${query}`, parameters as unknown[]);

      this.logger.warn(
        JSON.stringify({
          event: 'db.slow_query_plan',
          durationMs: time,
          explainThresholdMs: this.options.explainThresholdMs,
          query: this.truncate(query),
          plan: this.formatPlan(plan),
        }),
      );
    } catch (error) {
      this.logger.debug(
        JSON.stringify({
          event: 'db.slow_query_plan_failed',
          query: this.truncate(query),
          reason: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  /**
   * Only read-only statements may be re-executed under EXPLAIN ANALYZE. Any
   * already-wrapped EXPLAIN is rejected too, which prevents recursion when the
   * diagnostic query is itself slow.
   */
  private isSafeToExplain(query: string): boolean {
    const normalised = query.trim().toLowerCase();
    if (normalised.startsWith('explain')) {
      return false;
    }
    return normalised.startsWith('select') || normalised.startsWith('with');
  }

  /** Normalises the driver's plan output into a list of text rows. */
  private formatPlan(plan: unknown): string[] {
    if (!Array.isArray(plan)) {
      return [];
    }
    return plan.map((row) => {
      if (row && typeof row === 'object') {
        const values = Object.values(row as Record<string, unknown>);
        return values.length === 1 ? String(values[0]) : JSON.stringify(row);
      }
      return String(row);
    });
  }

  /**
   * Records parameter count and stringified values, guarding against oversized
   * payloads leaking into the log stream.
   */
  private describeParameters(parameters?: unknown[]): { count: number; values: string } {
    if (!parameters || parameters.length === 0) {
      return { count: 0, values: '[]' };
    }

    try {
      return { count: parameters.length, values: this.truncate(JSON.stringify(parameters)) };
    } catch {
      return { count: parameters.length, values: '[unserialisable]' };
    }
  }

  private truncate(value: string): string {
    return value.length > MAX_LOGGED_QUERY_LENGTH
      ? `${value.slice(0, MAX_LOGGED_QUERY_LENGTH)}...[truncated]`
      : value;
  }

  /* The remaining hooks keep the default TypeORM behaviour. */

  logQuery(query: string, parameters?: unknown[], _queryRunner?: QueryRunner): void {
    if (!this.options.enabled) {
      return;
    }
    this.logger.debug(
      JSON.stringify({
        event: 'db.query',
        query: this.truncate(query),
        parameters: this.describeParameters(parameters),
      }),
    );
  }

  logQueryError(
    error: string | Error,
    query: string,
    parameters?: unknown[],
    _queryRunner?: QueryRunner,
  ): void {
    if (!this.options.enabled) {
      return;
    }
    this.logger.error(
      JSON.stringify({
        event: 'db.query_error',
        reason: error instanceof Error ? error.message : error,
        query: this.truncate(query),
        parameters: this.describeParameters(parameters),
      }),
    );
  }

  logSchemaBuild(message: string, _queryRunner?: QueryRunner): void {
    if (!this.options.enabled) {
      return;
    }
    this.logger.debug(message);
  }

  logMigration(message: string, _queryRunner?: QueryRunner): void {
    if (!this.options.enabled) {
      return;
    }
    this.logger.log(message);
  }

  log(level: 'log' | 'info' | 'warn', message: unknown, _queryRunner?: QueryRunner): void {
    if (!this.options.enabled) {
      return;
    }
    if (level === 'warn') {
      this.logger.warn(message);
      return;
    }
    this.logger.log(message);
  }
}
