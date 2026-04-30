import { Logger, QueryRunner } from 'typeorm';
import { MetricsCollectionService } from '../metrics/metrics-collection.service';

/**
 * Provides type Orm Monitoring Logger behavior.
 */
export class TypeOrmMonitoringLogger implements Logger {
  constructor(private readonly metricsService: MetricsCollectionService) {}

  /**
   * Executes log Query.
   * @param _query The query value.
   * @param _parameters The parameters.
   * @param _queryRunner The query value.
   * @returns The operation result.
   */
  logQuery(_query: string, _parameters?: any[], _queryRunner?: QueryRunner) {
    // Optional: console.log(`[Query]: ${query}`);
  }

  /**
   * Executes log Query Error.
   * @param error The error.
   * @param query The query value.
   * @param _parameters The parameters.
   * @param _queryRunner The query value.
   * @returns The operation result.
   */
  logQueryError(
    error: string | Error,
    query: string,
    _parameters?: any[],
    _queryRunner?: QueryRunner,
  ) {
    console.error(`[Query Error]: ${error}`, query);
  }

  /**
   * Executes log Query Slow.
   * @param time The time.
   * @param query The query value.
   * @param _parameters The parameters.
   * @param _queryRunner The query value.
   * @returns The operation result.
   */
  logQuerySlow(time: number, query: string, _parameters?: any[], _queryRunner?: QueryRunner) {
    console.warn(`[Slow Query]: ${time}ms - ${query}`);
    const table = this.extractTable(query);
    // time is in milliseconds, convert to seconds
    this.metricsService.recordDbQuery('slow_query', table, time / 1000);
  }

  /**
   * Executes log Schema Build.
   * @param _message The message.
   * @param _queryRunner The query value.
   * @returns The operation result.
   */
  logSchemaBuild(_message: string, _queryRunner?: QueryRunner) {
    // console.log(`[Schema Build]: ${message}`);
  }
  /**
   * Executes log Migration.
   * @param _message The message.
   * @param _queryRunner The query value.
   * @returns The operation result.
   */
  logMigration(_message: string, _queryRunner?: QueryRunner) {
    // console.log(`[Migration]: ${message}`);
  }
  /**
   * Executes log.
   * @param level The level.
   * @param _message The message.
   * @param _queryRunner The query value.
   * @returns The operation result.
   */
  log(level: 'log' | 'info' | 'warn', _message: any, _queryRunner?: QueryRunner) {
    switch (level) {
      case 'log':
      case 'info':
        // console.log(`[TypeORM]: ${message}`);
        break;
      case 'warn':
        // console.warn(`[TypeORM]: ${message}`);
        break;
    }
  }

  private extractTable(query: string): string {
    // Simple regex to extract table name. Not perfect but useful for metrics.
    const match = query.match(/(?:FROM|UPDATE|INSERT INTO|DELETE FROM)\s+"?([a-zA-Z0-9_]+)"?/i);
    return match ? match[1] : 'unknown';
  }
}
