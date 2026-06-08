import { DataSource, EntitySubscriberInterface, QueryEvent } from 'typeorm';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { MetricsCollectionService } from './metrics-collection.service';

/**
 * TypeORM Database Metrics Subscriber
 *
 * Hooks into TypeORM's query lifecycle events to record per-query execution
 * times into the Prometheus `db_query_duration_seconds` histogram.
 *
 * Captured labels:
 *   - `query_type` – Normalised SQL verb (SELECT, INSERT, UPDATE, DELETE, OTHER)
 *   - `table`      – Primary table name extracted from the query string,
 *                    or "unknown" when the table cannot be determined.
 *
 * The subscriber registers itself with the TypeORM DataSource on
 * `onModuleInit` rather than via the static `@EventSubscriber()` decorator
 * so that we can inject NestJS services (MetricsCollectionService) without
 * requiring a global singleton.
 */
@Injectable()
export class DbMetricsSubscriber implements EntitySubscriberInterface, OnModuleInit {
  private readonly logger = new Logger(DbMetricsSubscriber.name);

  /** In-flight query start times keyed by a unique query identifier. */
  private readonly queryStartTimes = new Map<string, bigint>();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly metricsCollectionService: MetricsCollectionService,
  ) {}

  onModuleInit(): void {
    this.dataSource.subscribers.push(this);
    this.logger.log('DbMetricsSubscriber registered with TypeORM DataSource');
  }

  /**
   * Called before a query is executed.
   * Records the high-resolution start timestamp.
   */
  beforeQuery(event: QueryEvent<any>): void {
    if (!event.query) return;
    const key = this.queryKey(event);
    this.queryStartTimes.set(key, process.hrtime.bigint());
  }

  /**
   * Called after a query completes (whether successful or not).
   * Computes elapsed time and records it as a Prometheus observation.
   */
  afterQuery(event: QueryEvent<any>): void {
    if (!event.query) return;
    const key = this.queryKey(event);
    const start = this.queryStartTimes.get(key);
    if (!start) return;

    this.queryStartTimes.delete(key);

    try {
      const durationNs = process.hrtime.bigint() - start;
      const durationSeconds = Number(durationNs) / 1e9;
      const queryType = this.extractQueryType(event.query);
      const table = this.extractTable(event.query);

      this.metricsCollectionService.recordDbQuery(queryType, table, durationSeconds);
    } catch (err) {
      // Never let metric recording break query handling
      this.logger.warn(
        `DB metric recording failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Constructs a unique key for an in-flight query to correlate before/after
   * events.  TypeORM does not guarantee a stable query ID, so we derive one
   * from the query text + parameter count.
   */
  private queryKey(event: QueryEvent<any>): string {
    const paramCount = Array.isArray(event.parameters) ? event.parameters.length : 0;
    return `${event.query.slice(0, 120)}|${paramCount}|${process.hrtime.bigint()}`;
  }

  /**
   * Extracts the SQL verb from the query string.
   * Returns one of: SELECT | INSERT | UPDATE | DELETE | OTHER
   */
  private extractQueryType(query: string): string {
    const verb = query.trimStart().split(/\s+/)[0]?.toUpperCase();
    const known = new Set(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER']);
    return known.has(verb ?? '') ? (verb ?? 'OTHER') : 'OTHER';
  }

  /**
   * Heuristically extracts the primary table name from a SQL query.
   *
   * Handles common patterns:
   *   - SELECT … FROM "table_name" …
   *   - INSERT INTO "table_name" …
   *   - UPDATE "table_name" SET …
   *   - DELETE FROM "table_name" …
   */
  private extractTable(query: string): string {
    // Strip TypeORM-style quoted identifiers
    const normalised = query.replace(/"/g, '').replace(/`/g, '');

    const patterns = [/(?:FROM|JOIN)\s+(\w+)/i, /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(\w+)/i];

    for (const pattern of patterns) {
      const match = normalised.match(pattern);
      if (match?.[1]) {
        return match[1].toLowerCase();
      }
    }

    return 'unknown';
  }
}
