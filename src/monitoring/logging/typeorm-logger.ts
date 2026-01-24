import { Logger, QueryRunner } from 'typeorm';
import { MetricsCollectionService } from '../metrics/metrics-collection.service';

export class TypeOrmMonitoringLogger implements Logger {
  constructor(private readonly metricsService: MetricsCollectionService) {}

  logQuery(query: string, parameters?: any[], queryRunner?: QueryRunner) {
     // Optional: console.log(`[Query]: ${query}`);
  }

  logQueryError(error: string | Error, query: string, parameters?: any[], queryRunner?: QueryRunner) {
      console.error(`[Query Error]: ${error}`, query);
  }

  logQuerySlow(time: number, query: string, parameters?: any[], queryRunner?: QueryRunner) {
      console.warn(`[Slow Query]: ${time}ms - ${query}`);
      const table = this.extractTable(query);
      // time is in milliseconds, convert to seconds
      this.metricsService.recordDbQuery('slow_query', table, time / 1000);
  }

  logSchemaBuild(message: string, queryRunner?: QueryRunner) {
      console.log(`[Schema Build]: ${message}`);
  }
  logMigration(message: string, queryRunner?: QueryRunner) {
      console.log(`[Migration]: ${message}`);
  }
  log(level: 'log' | 'info' | 'warn', message: any, queryRunner?: QueryRunner) {
      switch (level) {
          case 'log':
          case 'info':
              console.log(`[TypeORM]: ${message}`);
              break;
          case 'warn':
              console.warn(`[TypeORM]: ${message}`);
              break;
      }
  }

  private extractTable(query: string): string {
    // Simple regex to extract table name. Not perfect but useful for metrics.
    const match = query.match(/(?:FROM|UPDATE|INSERT INTO|DELETE FROM)\s+"?([a-zA-Z0-9_]+)"?/i);
    return match ? match[1] : 'unknown';
  }
}
