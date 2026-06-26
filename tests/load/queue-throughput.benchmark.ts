/**
 * Queue Throughput Benchmark
 *
 * Measures Bull queue throughput with and without priority under load.
 *
 * Usage:
 *   npx ts-node tests/load/queue-throughput.benchmark.ts
 *
 * Prerequisites:
 *   - Redis running on REDIS_URL (default: redis://127.0.0.1:6379)
 */

import Bull from 'bull';
import { performance } from 'perf_hooks';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const JOB_COUNT = 5_000;
const CONCURRENCY = 10;

interface BenchmarkResult {
  label: string;
  totalJobs: number;
  durationMs: number;
  throughput: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
}

function createQueue(name: string): Bull.Queue {
  return new Bull(name, REDIS_URL, {
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: true,
    },
  });
}

async function runBenchmark(
  label: string,
  queue: Bull.Queue,
  jobs: { name: string; data: any; opts?: Bull.JobOptions }[],
  concurrency: number,
): Promise<BenchmarkResult> {
  const latencies: number[] = [];

  const processPromise = new Promise<void>((resolve, reject) => {
    queue.process(concurrency, async (job: Bull.Job) => {
      const start = performance.now();
      await job.progress(100);
      latencies.push(performance.now() - start);
    });

    queue.on('completed', (job: Bull.Job) => {
      if (latencies.length >= jobs.length) {
        resolve();
      }
    });

    queue.on('failed', (job: Bull.Job, err: Error) => {
      console.error(`Job ${job.id} failed: ${err.message}`);
    });
  });

  const addStart = performance.now();
  for (const job of jobs) {
    await queue.add(job.name, job.data, job.opts);
  }
  const addDuration = performance.now() - addStart;
  console.log(`  Added ${jobs.length} jobs in ${addDuration.toFixed(0)}ms`);

  const processStart = performance.now();
  await processPromise;
  const processDuration = performance.now() - processStart;

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];

  return {
    label,
    totalJobs: jobs.length,
    durationMs: processDuration,
    throughput: Math.round((jobs.length / processDuration) * 1000),
    p50Ms: Math.round(p50 * 100) / 100,
    p95Ms: Math.round(p95 * 100) / 100,
    p99Ms: Math.round(p99 * 100) / 100,
  };
}

function printResults(results: BenchmarkResult[]): void {
  console.log('\n========== BENCHMARK RESULTS ==========\n');
  console.log(
    `${'LABEL'.padEnd(30)} ${'JOBS'.padEnd(8)} ${'DURATION'.padEnd(12)} ${'THROUGHPUT'.padEnd(12)} ${'P50'.padEnd(10)} ${'P95'.padEnd(10)} ${'P99'.padEnd(10)}`,
  );
  console.log('-'.repeat(92));
  for (const r of results) {
    console.log(
      `${r.label.padEnd(30)} ${String(r.totalJobs).padEnd(8)} ${`${r.durationMs.toFixed(0)}ms`.padEnd(12)} ${`${r.throughput} jobs/s`.padEnd(12)} ${`${r.p50Ms}ms`.padEnd(10)} ${`${r.p95Ms}ms`.padEnd(10)} ${`${r.p99Ms}ms`.padEnd(10)}`,
    );
  }
  console.log('\n======================================\n');
}

async function main(): Promise<void> {
  console.log(`Queue Throughput Benchmark`);
  console.log(`  Redis: ${REDIS_URL}`);
  console.log(`  Jobs per test: ${JOB_COUNT}`);
  console.log(`  Concurrency: ${CONCURRENCY}\n`);

  const jobs = Array.from({ length: JOB_COUNT }, (_, i) => ({
    name: 'benchmark',
    data: { index: i, timestamp: Date.now() },
  }));

  const priorityJobs = Array.from({ length: JOB_COUNT }, (_, i) => ({
    name: 'benchmark',
    data: { index: i, timestamp: Date.now() },
    opts: { priority: i % 5 } as Bull.JobOptions,
  }));

  const results: BenchmarkResult[] = [];

  // Test 1: Without priority
  const q1 = createQueue('benchmark-default');
  await q1.empty();
  console.log('Test 1: Without priority...');
  results.push(await runBenchmark('Without priority', q1, jobs, CONCURRENCY));
  await q1.close();

  // Test 2: With priority
  const q2 = createQueue('benchmark-priority');
  await q2.empty();
  console.log('Test 2: With priority...');
  results.push(await runBenchmark('With priority', q2, priorityJobs, CONCURRENCY));
  await q2.close();

  // Test 3: Higher concurrency
  const q3 = createQueue('benchmark-high-concurrency');
  await q3.empty();
  console.log('Test 3: Concurrency x2...');
  results.push(
    await runBenchmark('Concurrency x2', q3, jobs, CONCURRENCY * 2),
  );
  await q3.close();

  printResults(results);
  console.log('Benchmark complete. Clean up queues manually via Redis CLI:\n');
  console.log('  redis-cli KEYS "bull:benchmark-*" | xargs redis-cli DEL');
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
