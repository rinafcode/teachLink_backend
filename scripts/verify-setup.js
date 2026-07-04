#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const SEPARATOR = '─'.repeat(56);

let exitCode = 0;
const results = [];

function pass(label, detail = '') {
  const msg = detail ? `${label} (${detail})` : label;
  console.log(`  ${'✓'.padEnd(3)}${'PASS'.padEnd(8)}${msg}`);
}

function fail(label, detail = '') {
  const msg = detail ? `${label} — ${detail}` : label;
  console.log(`  ${'✗'.padEnd(3)}${'FAIL'.padEnd(8)}${msg}`);
  exitCode = 1;
}

function skip(label, reason) {
  console.log(`  ${'−'.padEnd(3)}${'SKIP'.padEnd(8)}${label} (${reason})`);
}

function header(title) {
  console.log(`\n${SEPARATOR}`);
  console.log(` ${title}`);
  console.log(SEPARATOR);
}

async function check(label, fn) {
  try {
    const result = await fn();
    if (result === true || result === undefined) {
      pass(label);
    } else {
      fail(label, result);
    }
  } catch (e) {
    fail(label, e.message || e);
  }
  results.push(label);
}

// ────────────────────────────────────────────────────────────────
// 1. Node version
// ────────────────────────────────────────────────────────────────
header('1. Node.js version');

await check('Node >= 18.0.0', () => {
  const [major] = process.versions.node.split('.').map(Number);
  if (major < 18) return `found ${process.version}, need >= 18`;
  return true;
});

// ────────────────────────────────────────────────────────────────
// 2. Package manager
// ────────────────────────────────────────────────────────────────
header('2. Package manager');

await check('pnpm installed', () => {
  const out = execSync('pnpm --version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  pass('pnpm version', out);
  return true;
});

await check('Dependencies installed', () => {
  if (!fs.existsSync(path.join(process.cwd(), 'node_modules'))) {
    return 'node_modules missing — run pnpm install';
  }
  if (!fs.existsSync(path.join(process.cwd(), 'node_modules', '@nestjs', 'core'))) {
    return 'node_modules incomplete — run pnpm install';
  }
  return true;
});

// ────────────────────────────────────────────────────────────────
// 3. Environment file
// ────────────────────────────────────────────────────────────────
header('3. Environment file');

const envPath = path.join(process.cwd(), '.env');
await check('.env file exists', () => fs.existsSync(envPath) || 'copy .env.example to .env');

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');

  await check('.env has DATABASE_HOST', () => {
    if (!/^DATABASE_HOST=/m.test(envContent)) return 'missing DATABASE_HOST';
    return true;
  });
  await check('.env has DATABASE_PORT', () => {
    if (!/^DATABASE_PORT=/m.test(envContent)) return 'missing DATABASE_PORT';
    return true;
  });
  await check('.env has DATABASE_USER', () => {
    if (!/^DATABASE_USER=/m.test(envContent)) return 'missing DATABASE_USER';
    return true;
  });
  await check('.env has DATABASE_PASSWORD', () => {
    if (!/^DATABASE_PASSWORD=/m.test(envContent)) return 'missing DATABASE_PASSWORD';
    return true;
  });
  await check('.env has DATABASE_NAME', () => {
    if (!/^DATABASE_NAME=/m.test(envContent)) return 'missing DATABASE_NAME';
    return true;
  });
  await check('.env has REDIS_HOST', () => {
    if (!/^REDIS_HOST=/m.test(envContent)) return 'missing REDIS_HOST';
    return true;
  });
  await check('.env has REDIS_PORT', () => {
    if (!/^REDIS_PORT=/m.test(envContent)) return 'missing REDIS_PORT';
    return true;
  });
  await check('.env has JWT_SECRET', () => {
    if (!/^JWT_SECRET=/m.test(envContent)) return 'missing JWT_SECRET';
    return true;
  });
}

// ────────────────────────────────────────────────────────────────
// 4. Docker and services
// ────────────────────────────────────────────────────────────────
header('4. Docker services');

await check('Docker available', () => {
  execSync('docker info', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  return true;
});

await check('Docker Compose available', () => {
  execSync('docker compose version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  return true;
});

try {
  const psOut = execSync('docker compose ps --format json 2>NUL', {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();

  if (psOut) {
    let services;
    try {
      services = JSON.parse(psOut);
    } catch {
      services = [];
    }
    const serviceList = Array.isArray(services) ? services : [services];

    const hasPostgres = serviceList.some((s) => s.Name && s.Name.includes('postgres'));
    const hasRedis = serviceList.some((s) => s.Name && s.Name.includes('redis'));

    if (hasPostgres) {
      const pg = serviceList.find((s) => s.Name && s.Name.includes('postgres'));
      const pgStatus = pg ? pg.Status || pg.Health || 'running' : 'running';
      await check('PostgreSQL container', () => {
        if (pgStatus.includes('unhealthy')) return 'container unhealthy';
        if (pgStatus.includes('exited')) return 'container exited';
        return true;
      });
    } else {
      skip('PostgreSQL container', 'not running — start with: docker compose up -d postgres');
    }

    if (hasRedis) {
      const rd = serviceList.find((s) => s.Name && s.Name.includes('redis'));
      const rdStatus = rd ? rd.Status || rd.Health || 'running' : 'running';
      await check('Redis container', () => {
        if (rdStatus.includes('unhealthy')) return 'container unhealthy';
        if (rdStatus.includes('exited')) return 'container exited';
        return true;
      });
    } else {
      skip('Redis container', 'not running — start with: docker compose up -d redis');
    }
  } else {
    skip('Docker services', 'no containers from compose — start with: docker compose up -d');
  }
} catch {
  skip('Docker services', 'docker compose not available in this directory');
}

// ────────────────────────────────────────────────────────────────
// 5. Database connectivity
// ────────────────────────────────────────────────────────────────
header('5. Database connectivity');

const envFile = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    envFile[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
}

const pgHost = envFile.DATABASE_HOST || process.env.DATABASE_HOST || 'localhost';
const pgPort = parseInt(envFile.DATABASE_PORT || process.env.DATABASE_PORT || '5432', 10);
const pgUser = envFile.DATABASE_USER || process.env.DATABASE_USER || 'postgres';
const pgPass = envFile.DATABASE_PASSWORD || process.env.DATABASE_PASSWORD || 'postgres';
const pgDb = envFile.DATABASE_NAME || process.env.DATABASE_NAME || 'teachlink';

await check('PostgreSQL reachable', async () => {
  let Client;
  try {
    Client = require('pg').Client;
  } catch {
    return 'pg module not found — run pnpm install';
  }
  try {
    const client = new Client({
      host: pgHost, port: pgPort, user: pgUser,
      password: pgPass, database: pgDb,
      connectionTimeoutMillis: 5000,
    });
    await client.connect();
    const result = await client.query('SELECT 1 AS ok');
    await client.end();
    if (result.rows[0].ok !== 1) return 'query returned unexpected result';
    return true;
  } catch (e) {
    if (e.code === 'ECONNREFUSED') return `connection refused at ${pgHost}:${pgPort}`;
    if (e.code === 'ENOTFOUND') return `host not found: ${pgHost}`;
    if (e.code === '28P01') return 'authentication failed — check DATABASE_USER/PASSWORD';
    if (e.code === '3D000') return `database "${pgDb}" does not exist`;
    return e.message;
  }
});

// ────────────────────────────────────────────────────────────────
// 6. Redis connectivity
// ────────────────────────────────────────────────────────────────
header('6. Redis connectivity');

const redisHost = envFile.REDIS_HOST || process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(envFile.REDIS_PORT || process.env.REDIS_PORT || '6379', 10);

await check('Redis reachable', async () => {
  let Redis;
  try {
    Redis = require('ioredis');
  } catch {
    return 'ioredis module not found — run pnpm install';
  }
  try {
    const redis = new Redis({
      host: redisHost, port: redisPort,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      lazyConnect: true,
    });
    await redis.connect();
    const pong = await redis.ping();
    await redis.quit();
    if (pong !== 'PONG') return `unexpected ping response: ${pong}`;
    return true;
  } catch (e) {
    if (e.code === 'ECONNREFUSED') return `connection refused at ${redisHost}:${redisPort}`;
    if (e.code === 'ENOTFOUND') return `host not found: ${redisHost}`;
    return e.message;
  }
});

// ────────────────────────────────────────────────────────────────
// 7. Server health
// ────────────────────────────────────────────────────────────────
header('7. Server health');

const appPort = parseInt(envFile.PORT || process.env.PORT || '3000', 10);

await check('Health endpoint responds', async () => {
  try {
    const res = await fetch(`http://localhost:${appPort}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.status !== 200) return `HTTP ${res.status}`;
    return true;
  } catch (e) {
    if (e.name === 'TimeoutError' || e.name === 'AbortError') {
      return `timed out after 5s — is the server running on port ${appPort}?`;
    }
    if (e.code === 'ECONNREFUSED') {
      return `connection refused on port ${appPort} — start with: pnpm start:dev`;
    }
    return e.message;
  }
});

// ────────────────────────────────────────────────────────────────
// Summary
// ────────────────────────────────────────────────────────────────
console.log(`\n${SEPARATOR}`);
if (exitCode === 0) {
  console.log(' ✅ All checks passed — your development environment is ready!');
} else {
  console.log(' ❌ Some checks failed. See details above and refer to:');
  console.log('    docs/setup.md           — step-by-step setup guide');
  console.log('    docs/troubleshooting.md  — common issues and fixes');
}
console.log(SEPARATOR);

process.exit(exitCode);
