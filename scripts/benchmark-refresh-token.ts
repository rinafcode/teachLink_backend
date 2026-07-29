/**
 * Benchmark: Refresh Token Verification Throughput
 *
 * Compares the performance of three approaches for refresh token hashing/verification:
 *   1. bcrypt (cost factor 12) — the original approach
 *   2. SHA-256 + timingSafeEqual — intermediate approach
 *   3. HMAC-SHA-256 + timingSafeEqual — the current approach
 *
 * Run with:
 *   npx ts-node scripts/benchmark-refresh-token.ts
 */

import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const BCRYPT_ROUNDS = 12;
const WARMUP_OPS = 50;
const BENCHMARK_DURATION_MS = 5_000; // run each benchmark for up to 5 s
const HMAC_SECRET = 'benchmark-test-secret-key-for-hmac-sha-256';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateTestToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmacSha256Hex(secret: string, value: string): string {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

/**
 * Run a single benchmark: execute `op` as many times as possible within
 * `durationMs` milliseconds (after a warm-up phase). Returns ops/sec and ms/op.
 */
async function runBenchmark(
  label: string,
  durationMs: number,
  warmupOps: number,
  op: () => Promise<void> | void,
): Promise<{ opsPerSec: number; msPerOp: number }> {
  // Warm-up
  for (let i = 0; i < warmupOps; i++) {
    await op();
  }

  // Timed run
  const start = process.hrtime.bigint();
  const endNs = BigInt(durationMs) * 1_000_000n; // ms → ns
  let count = 0;

  while (true) {
    await op();
    count++;
    const elapsed = process.hrtime.bigint() - start;
    if (elapsed >= endNs) break;
  }

  const elapsedNs = Number(process.hrtime.bigint() - start);
  const elapsedMs = elapsedNs / 1_000_000;
  const opsPerSec = Math.round((count / elapsedMs) * 1000);
  const msPerOp = parseFloat((elapsedMs / count).toFixed(4));

  return { opsPerSec, msPerOp };
}

// ---------------------------------------------------------------------------
// Table formatting
// ---------------------------------------------------------------------------

function padRight(str: string, width: number): string {
  return str.length >= width ? str : str + ' '.repeat(width - str.length);
}

function padCenter(str: string, width: number): string {
  if (str.length >= width) return str;
  const totalPad = width - str.length;
  const leftPad = Math.floor(totalPad / 2);
  const rightPad = totalPad - leftPad;
  return ' '.repeat(leftPad) + str + ' '.repeat(rightPad);
}

function padLeft(str: string, width: number): string {
  return str.length >= width ? str : ' '.repeat(width - str.length) + str;
}

function printTable(
  results: Array<{ label: string; opsPerSec: number; msPerOp: number }>,
): void {
  const colMethod = 32;
  const colOps = 14;
  const colMsOp = 16;
  const colVs = 12;

  const topBorder =
    '╔' +
    '═'.repeat(colMethod + 2) +
    '╦' +
    '═'.repeat(colOps + 2) +
    '╦' +
    '═'.repeat(colMsOp + 2) +
    '╦' +
    '═'.repeat(colVs + 2) +
    '╗';

  const headerSep =
    '╠' +
    '═'.repeat(colMethod + 2) +
    '╬' +
    '═'.repeat(colOps + 2) +
    '╬' +
    '═'.repeat(colMsOp + 2) +
    '╬' +
    '═'.repeat(colVs + 2) +
    '╣';

  const bottomBorder =
    '╚' +
    '═'.repeat(colMethod + 2) +
    '╩' +
    '═'.repeat(colOps + 2) +
    '╩' +
    '═'.repeat(colMsOp + 2) +
    '╩' +
    '═'.repeat(colVs + 2) +
    '╝';

  const headerRow =
    '║ ' +
    padRight('Method', colMethod) +
    ' ║ ' +
    padCenter('Ops/sec', colOps) +
    ' ║ ' +
    padCenter('ms/op', colMsOp) +
    ' ║ ' +
    padCenter('vs bcrypt', colVs) +
    ' ║';

  const bcryptOps = results[0].opsPerSec;

  console.log('');
  console.log(topBorder);
  console.log(headerRow);
  console.log(headerSep);

  for (const r of results) {
    const multiplier = (bcryptOps / r.opsPerSec).toFixed(1);
    const vsBcrypt =
      r === results[0] ? '1.0x' : `${(r.opsPerSec / bcryptOps).toFixed(1)}x`;

    const row =
      '║ ' +
      padRight(r.label, colMethod) +
      ' ║ ' +
      padLeft(r.opsPerSec.toLocaleString(), colOps) +
      ' ║ ' +
      padLeft(r.msPerOp.toFixed(4), colMsOp) +
      ' ║ ' +
      padCenter(vsBcrypt, colVs) +
      ' ║';

    console.log(row);
  }

  console.log(bottomBorder);
  console.log('');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Refresh Token Verification Benchmark');
  console.log('  bcrypt vs SHA-256 vs HMAC-SHA-256');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`  Bcrypt rounds : ${BCRYPT_ROUNDS}`);
  console.log(`  Warm-up ops   : ${WARMUP_OPS}`);
  console.log(`  Benchmark time: ${BENCHMARK_DURATION_MS / 1000}s per method`);
  console.log('');

  const token = generateTestToken();
  console.log(`  Test token (hex): ${token.substring(0, 32)}...`);
  console.log('');

  // -----------------------------------------------------------------------
  // 1. bcrypt (cost 12)
  // -----------------------------------------------------------------------
  console.log('  [1/3] Benchmarking bcrypt (cost 12) ...');
  const bcryptHash = await bcrypt.hash(token, BCRYPT_ROUNDS);

  const bcryptResult = await runBenchmark(
    'bcrypt (cost 12)',
    BENCHMARK_DURATION_MS,
    WARMUP_OPS,
    async () => {
      await bcrypt.compare(token, bcryptHash);
    },
  );
  console.log(`         → ${bcryptResult.opsPerSec.toLocaleString()} ops/sec, ${bcryptResult.msPerOp.toFixed(2)} ms/op`);

  // -----------------------------------------------------------------------
  // 2. SHA-256 + timingSafeEqual
  // -----------------------------------------------------------------------
  console.log('  [2/3] Benchmarking SHA-256 + timingSafeEqual ...');
  const sha256Hash = sha256Hex(token);
  const sha256Buf = Buffer.from(sha256Hash, 'hex');

  const sha256Result = await runBenchmark(
    'SHA-256 + timingSafeEqual',
    BENCHMARK_DURATION_MS,
    WARMUP_OPS,
    () => {
      const candidate = Buffer.from(sha256Hex(token), 'hex');
      crypto.timingSafeEqual(candidate, sha256Buf);
    },
  );
  console.log(`         → ${sha256Result.opsPerSec.toLocaleString()} ops/sec, ${sha256Result.msPerOp.toFixed(4)} ms/op`);

  // -----------------------------------------------------------------------
  // 3. HMAC-SHA-256 + timingSafeEqual
  // -----------------------------------------------------------------------
  console.log('  [3/3] Benchmarking HMAC-SHA-256 + timingSafeEqual ...');
  const hmacHash = hmacSha256Hex(HMAC_SECRET, token);
  const hmacBuf = Buffer.from(hmacHash, 'hex');

  const hmacResult = await runBenchmark(
    'HMAC-SHA-256 + timingSafeEqual',
    BENCHMARK_DURATION_MS,
    WARMUP_OPS,
    () => {
      const candidate = Buffer.from(hmacSha256Hex(HMAC_SECRET, token), 'hex');
      crypto.timingSafeEqual(candidate, hmacBuf);
    },
  );
  console.log(`         → ${hmacResult.opsPerSec.toLocaleString()} ops/sec, ${hmacResult.msPerOp.toFixed(4)} ms/op`);

  // -----------------------------------------------------------------------
  // Comparison table
  // -----------------------------------------------------------------------
  const results = [
    { label: 'bcrypt (cost 12)', ...bcryptResult },
    { label: 'SHA-256 + timingSafeEqual', ...sha256Result },
    { label: 'HMAC-SHA-256 + timingSafeEqual', ...hmacResult },
  ];

  printTable(results);

  // Summary
  const speedup = (hmacResult.opsPerSec / bcryptResult.opsPerSec).toFixed(0);
  console.log(`  Summary: HMAC-SHA-256 is ~${speedup}x faster than bcrypt for refresh token verification.`);
  console.log('');
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
