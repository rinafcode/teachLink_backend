/**
 * Centralised configuration for the automatic index optimizer, resolved from
 * environment variables. Conservative defaults are chosen so the optimizer is
 * safe to enable: it runs in dry-run and never auto-applies DDL unless a human
 * opts in.
 *
 * Env vars (all optional):
 *   INDEX_OPT_ENABLED               – master switch for the scheduled run (default false)
 *   INDEX_OPT_DRY_RUN               – analyse/recommend only, never apply DDL (default true)
 *   INDEX_OPT_AUTO_CREATE           – allow automatic index creation (default false)
 *   INDEX_OPT_AUTO_DROP_STALE       – allow automatic stale-index removal (default false)
 *   INDEX_OPT_SEQ_SCAN_THRESHOLD    – min seq scans before a table is a candidate (default 1000)
 *   INDEX_OPT_SEQ_SCAN_RATIO        – min seq/idx scan ratio to flag a table (default 0.5)
 *   INDEX_OPT_SLOW_QUERY_MS         – mean exec time (ms) marking a statement slow (default 200)
 *   INDEX_OPT_STALE_MIN_SIZE_BYTES  – ignore stale indexes smaller than this (default 1MB)
 *   INDEX_OPT_STALE_MIN_SCANS       – scans at/below which an index is stale (default 0)
 *   INDEX_OPT_MAX_CREATE_PER_RUN    – cap on indexes created in one cycle (default 3)
 *   INDEX_OPT_SCHEMA                – schema to operate on (default public)
 */
export interface IndexOptimizationConfig {
  enabled: boolean;
  dryRun: boolean;
  autoCreate: boolean;
  autoDropStale: boolean;
  seqScanThreshold: number;
  seqScanRatio: number;
  slowQueryMs: number;
  staleMinSizeBytes: number;
  staleMinScans: number;
  maxCreatePerRun: number;
  schema: string;
}

const bool = (value: string | undefined, fallback: boolean): boolean =>
  value === undefined ? fallback : value.toLowerCase() === 'true';

const int = (value: string | undefined, fallback: number): number => {
  const parsed = parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const num = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function resolveIndexOptimizationConfig(): IndexOptimizationConfig {
  return {
    enabled: bool(process.env.INDEX_OPT_ENABLED, false),
    dryRun: bool(process.env.INDEX_OPT_DRY_RUN, true),
    autoCreate: bool(process.env.INDEX_OPT_AUTO_CREATE, false),
    autoDropStale: bool(process.env.INDEX_OPT_AUTO_DROP_STALE, false),
    seqScanThreshold: int(process.env.INDEX_OPT_SEQ_SCAN_THRESHOLD, 1000),
    seqScanRatio: num(process.env.INDEX_OPT_SEQ_SCAN_RATIO, 0.5),
    slowQueryMs: num(process.env.INDEX_OPT_SLOW_QUERY_MS, 200),
    staleMinSizeBytes: int(process.env.INDEX_OPT_STALE_MIN_SIZE_BYTES, 1024 * 1024),
    staleMinScans: int(process.env.INDEX_OPT_STALE_MIN_SCANS, 0),
    maxCreatePerRun: int(process.env.INDEX_OPT_MAX_CREATE_PER_RUN, 3),
    schema: process.env.INDEX_OPT_SCHEMA ?? 'public',
  };
}
