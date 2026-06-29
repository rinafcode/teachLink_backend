#!/usr/bin/env ts-node
/**
 * benchmark-search.ts
 * ===================
 * Benchmarks the course full-text search before and after the GIN-index
 * migration by running 200 randomised queries against a real database and
 * reporting P50 / P95 / P99 latencies.
 *
 * Usage (requires a running Postgres with the DB specified in DATABASE_URL):
 *
 *   # Seed 100k courses first (only needed once):
 *   DATABASE_URL=postgres://... ts-node scripts/benchmark-search.ts --seed
 *
 *   # Run the benchmark (after migration has been applied):
 *   DATABASE_URL=postgres://... ts-node scripts/benchmark-search.ts
 *
 * The script will:
 *   1. Connect directly via `pg` (no NestJS overhead) to measure raw DB time.
 *   2. Run 200 search queries with realistic terms.
 *   3. Print P50 / P95 / P99 timings and flag whether P95 < 50 ms (the
 *      acceptance criterion).
 *
 * Prerequisites:
 *   pnpm add -D ts-node pg @types/pg   (already in devDependencies)
 */

import { Client } from 'pg';
import { performance } from 'perf_hooks';

// ─── Configuration ────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/teachlink';
const SEED_COUNT = 100_000;
const WARMUP_RUNS = 20;
const BENCHMARK_RUNS = 200;
const P95_BUDGET_MS = 50; // Acceptance criterion

const SEARCH_TERMS = [
  'javascript', 'python', 'web development', 'machine learning',
  'data science', 'react hooks', 'node js', 'typescript',
  'sql database', 'api design', 'docker kubernetes', 'css flexbox',
  'vue angular', 'cloud computing', 'agile scrum', 'design patterns',
  'functional programming', 'graphql rest', 'security testing', 'devops',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function randomTerm(): string {
  return SEARCH_TERMS[Math.floor(Math.random() * SEARCH_TERMS.length)];
}

async function seedCourses(client: Client): Promise<void> {
  console.log(`\nSeeding ${SEED_COUNT.toLocaleString()} courses…`);
  const batch = 1000;
  for (let i = 0; i < SEED_COUNT; i += batch) {
    const values: string[] = [];
    const params: unknown[] = [];
    let p = 1;
    for (let j = 0; j < batch && i + j < SEED_COUNT; j++) {
      const n = i + j;
      const term = SEARCH_TERMS[n % SEARCH_TERMS.length];
      values.push(`($${p++}, $${p++}, $${p++})`);
      params.push(
        `${term.charAt(0).toUpperCase() + term.slice(1)} Course #${n}`,
        `A comprehensive guide to ${term}. Covers fundamentals through advanced topics. Row ${n}.`,
        'published',
      );
    }
    await client.query(
      `INSERT INTO course (title, description, status)
       VALUES ${values.join(', ')}
       ON CONFLICT DO NOTHING`,
      params,
    );
    process.stdout.write(`\r  ${Math.min(i + batch, SEED_COUNT).toLocaleString()} / ${SEED_COUNT.toLocaleString()}`);
  }
  console.log('\n  Done.');
}

// ─── Benchmark functions ──────────────────────────────────────────────────────

/** Legacy ILIKE path (before migration). */
async function benchmarkIlike(client: Client, term: string): Promise<number> {
  const t0 = performance.now();
  await client.query(
    `SELECT id, title FROM course
     WHERE title ILIKE $1 OR description ILIKE $1
     LIMIT 20`,
    [`%${term}%`],
  );
  return performance.now() - t0;
}

/** New FTS path (after migration). */
async function benchmarkFts(client: Client, term: string): Promise<number> {
  const t0 = performance.now();
  await client.query(
    `SELECT id, title,
            ts_rank(search_vector, plainto_tsquery('english', $1)) AS relevance
     FROM course
     WHERE search_vector @@ plainto_tsquery('english', $1)
     ORDER BY relevance DESC
     LIMIT 20`,
    [term],
  );
  return performance.now() - t0;
}

async function runBenchmark(
  label: string,
  fn: (client: Client, term: string) => Promise<number>,
  client: Client,
): Promise<void> {
  console.log(`\n── ${label} ──`);

  // Warmup
  for (let i = 0; i < WARMUP_RUNS; i++) {
    await fn(client, randomTerm());
  }

  const timings: number[] = [];
  for (let i = 0; i < BENCHMARK_RUNS; i++) {
    timings.push(await fn(client, randomTerm()));
  }

  timings.sort((a, b) => a - b);
  const p50 = percentile(timings, 50);
  const p95 = percentile(timings, 95);
  const p99 = percentile(timings, 99);
  const avg = timings.reduce((s, v) => s + v, 0) / timings.length;

  console.log(`  Runs : ${BENCHMARK_RUNS}`);
  console.log(`  Avg  : ${avg.toFixed(2)} ms`);
  console.log(`  P50  : ${p50.toFixed(2)} ms`);
  console.log(`  P95  : ${p95.toFixed(2)} ms  ${p95 < P95_BUDGET_MS ? '✅ under budget' : `❌ OVER ${P95_BUDGET_MS}ms budget`}`);
  console.log(`  P99  : ${p99.toFixed(2)} ms`);
}

// ─── Entry point ─────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const seed = args.includes('--seed');
  const skipIlike = args.includes('--fts-only');
  const skipFts = args.includes('--ilike-only');

  console.log('Connecting to:', DATABASE_URL.replace(/:[^:@]+@/, ':***@'));
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  // Check row count
  const { rows: [{ count }] } = await client.query<{ count: string }>('SELECT COUNT(*) FROM course');
  console.log(`Courses in DB: ${parseInt(count, 10).toLocaleString()}`);

  if (seed) {
    await seedCourses(client);
  }

  if (parseInt(count, 10) < 1000 && !seed) {
    console.warn('\n⚠️  Less than 1 000 courses in DB — run with --seed for a realistic benchmark.');
  }

  // Check if GIN index exists (i.e. migration has been applied)
  const { rows: idxRows } = await client.query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes
     WHERE tablename = 'course' AND indexname = 'IDX_course_search_vector'`,
  );
  const ginExists = idxRows.length > 0;
  console.log(`GIN index present: ${ginExists ? '✅ yes' : '❌ no (run migration first)'}`);

  if (!skipIlike) {
    await runBenchmark('BEFORE — ILIKE (sequential scan)', benchmarkIlike, client);
  }

  if (!skipFts) {
    if (!ginExists) {
      console.log('\n⚠️  Skipping FTS benchmark — GIN index not found. Apply the migration first.');
    } else {
      await runBenchmark('AFTER  — FTS / GIN index', benchmarkFts, client);
    }
  }

  await client.end();
  console.log('\nDone.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
