import { Injectable, Logger } from '@nestjs/common';
import { Logger as TypeOrmLogger, QueryRunner } from 'typeorm';

const EXPLAIN_THRESHOLD_MS = parseInt(process.env.DB_EXPLAIN_THRESHOLD_MS ?? '2000', 10);

/**
 * TypeORM logger that emits structured slow-query logs and, for the
 * slowest queries, an async EXPLAIN ANALYZE. Wired up only outside the
 * test environment via getDatabaseConfig().
 */
@Injectable()
export class SlowQueryLogger implements TypeOrmLogger {
  private readonly logger = new Logger(SlowQueryLogger.name);

  logQuery(): void {
    // Per-query logging is intentionally a no-op; only slow queries are logged.
  }

  logQueryError(error: string | Error, query: string, parameters?: unknown[]): void {
    this.logger.error(
      JSON.stringify({
        message: 'Query error',
        error: error instanceof Error ? error.message : error,
        query,
        parameters,
      }),
    );
  }

  logQuerySlow(time: number, query: string, parameters?: unknown[], queryRunner?: QueryRunner): void {
    this.logger.warn(
      JSON.stringify({
        message: 'Slow query detected',
        durationMs: time,
        query,
        parameters,
      }),
    );

    if (time >= EXPLAIN_THRESHOLD_MS && this.isSelect(query)) {
      this.logExplainAnalyze(query, parameters, queryRunner).catch((err: Error) =>
        this.logger.error(`Failed to run EXPLAIN ANALYZE: ${err.message}`),
      );
    }
  }

  logSchemaBuild(message: string): void {
    this.logger.log(message);
  }

  logMigration(message: string): void {
    this.logger.log(message);
  }

  log(level: 'log' | 'info' | 'warn', message: unknown): void {
    if (level === 'warn') {
      this.logger.warn(message as string);
    } else {
      this.logger.log(message as string);
    }
  }

  private isSelect(query: string): boolean {
    return /^\s*select/i.test(query);
  }

  private async logExplainAnalyze(
    query: string,
    parameters: unknown[] | undefined,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    if (!queryRunner) {
      return;
    }

    const explain = await queryRunner.connection.query(`EXPLAIN ANALYZE ${query}`, parameters as any[]);

    this.logger.warn(
      JSON.stringify({
        message: 'EXPLAIN ANALYZE for slow query',
        query,
        explain,
      }),
    );
  }
}
