/**
 * Type definitions for the automatic database index optimizer.
 *
 * The optimizer is PostgreSQL-specific: it reads the catalog and the
 * statistics collector (pg_stat_*) to recommend, create, monitor and retire
 * indexes. All queries are read-only except the explicit create/drop actions.
 */

/** Why the optimizer believes an index would help. */
export enum RecommendationReason {
  /** Table receives many sequential scans relative to index scans. */
  HIGH_SEQ_SCAN = 'high_seq_scan',
  /** A frequently executed / slow statement filters on un-indexed columns. */
  SLOW_QUERY = 'slow_query',
}

/** A single proposed index. */
export interface IIndexRecommendation {
  table: string;
  columns: string[];
  reason: RecommendationReason;
  /** Generated, deterministic index name (idx_<table>_<cols>). */
  suggestedName: string;
  /** The DDL that would be executed to create it. */
  ddl: string;
  /** Relative priority 0-100; higher means more impactful. */
  score: number;
  /** Human-readable rationale for surfacing in dashboards/logs. */
  rationale: string;
}

/** Result of attempting to create one recommended index. */
export interface IIndexCreationResult {
  suggestedName: string;
  table: string;
  ddl: string;
  /** True when the index was actually created (false in dry-run/skip). */
  created: boolean;
  skippedReason?: string;
  error?: string;
}

/** Usage statistics for a single existing index. */
export interface IIndexUsageStat {
  schema: string;
  table: string;
  indexName: string;
  /** Number of index scans initiated on this index. */
  scans: number;
  /** Index size in bytes. */
  sizeBytes: number;
  isUnique: boolean;
  isPrimary: boolean;
  /** True when backing a constraint (PK/unique/FK) — never auto-dropped. */
  isConstraint: boolean;
}

/** An index judged stale and eligible for removal. */
export interface IStaleIndex {
  schema: string;
  table: string;
  indexName: string;
  scans: number;
  sizeBytes: number;
  /** The DROP DDL that would be executed. */
  ddl: string;
  reason: string;
}

/** Result of attempting to drop a stale index. */
export interface IStaleIndexRemovalResult {
  indexName: string;
  table: string;
  dropped: boolean;
  skippedReason?: string;
  error?: string;
}

/** Summary returned by a full optimization cycle. */
export interface IOptimizationRunSummary {
  startedAt: string;
  finishedAt: string;
  dryRun: boolean;
  recommendations: IIndexRecommendation[];
  created: IIndexCreationResult[];
  removedStale: IStaleIndexRemovalResult[];
}
