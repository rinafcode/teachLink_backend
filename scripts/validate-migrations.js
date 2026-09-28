/**
 * CI check: migrations must not open their own connections (issue #1211).
 *
 * TypeORM's default `migrationsTransactionMode` is `all` — every migration in
 * a run shares a single transaction. A migration that opens its own pooled
 * connection via `createQueryRunner()` (or reaches the connection through
 * `queryRunner.connection`) cannot see tables/rows created by earlier
 * migrations in the same run, and its changes escape the shared transaction
 * (they are NOT rolled back if a later migration fails).
 *
 * This was the root cause of the `fix-invoice-number-sequence` failure
 * resolved in #1195: a fresh connection queried the `invoices` table before
 * the migration that creates it had committed, so the run crashed from scratch
 * on every fresh database.
 *
 * Rule: a migration must only use the `QueryRunner` passed to its `up()` /
 * `down()` method.
 *
 * Usage: node scripts/validate-migrations.js [path ...]
 * Exit code 0 = all pass, 1 = violations.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');

// Directories whose `.ts` files are TypeORM migration classes. Mirrors the
// `migrations` glob in src/config/datasource.ts (`src/migrations/[0-9]*`) plus
// the migration dirs of feature modules that follow the same convention.
const MIGRATION_DIRS = [
  path.join(SRC_DIR, 'migrations'),
  path.join(SRC_DIR, 'achievements', 'migrations'),
  path.join(SRC_DIR, 'notifications', 'migrations'),
];

// Whether a file inside a migration dir is a migration class.
// - src/migrations: basename starts with a digit (TypeORM's timestamp
//   convention), matching the `migrations` glob in src/config/datasource.ts.
//   Non-migration helpers that live there too (services, entities) are
//   excluded — runtime service code legitimately opens query runners.
// - feature-module migration dirs (achievements, notifications): every .ts
//   file is a migration, regardless of naming.
const DIGIT_PREFIX = /^[0-9].*\.(ts|js)$/;
const ANY_MIGRATION = /\.(ts|js)$/;

function isMigrationFile(absolutePath, dir) {
  const regex = dir === path.join(SRC_DIR, 'migrations') ? DIGIT_PREFIX : ANY_MIGRATION;
  return regex.test(path.basename(absolutePath));
}

function findMigrationFiles(dir) {
  let results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.isFile()) {
      const fullPath = path.join(dir, entry.name);
      if (isMigrationFile(fullPath, dir)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

// Patterns that open a separate pooled connection or reach outside the
// transaction the migration runner gave us.
const FORBIDDEN_PATTERNS = [
  {
    name: 'createQueryRunner()',
    // queryRunner.connection.createQueryRunner(), dataSource.createQueryRunner(), ...
    regex: /\bcreateQueryRunner\s*\(/g,
  },
  {
    name: 'queryRunner.connection',
    // queryRunner.connection / queryRunner.manager.connection — a direct
    // escape hatch off the shared transaction.
    regex: /\.connection\b/g,
  },
];

function violationsFor(file) {
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  const violations = [];

  for (const pattern of FORBIDDEN_PATTERNS) {
    let match;
    while ((match = pattern.regex.exec(content)) !== null) {
      const lineNumber = content.slice(0, match.index).split('\n').length;
      const line = lines[lineNumber - 1].trim();
      violations.push({ pattern: pattern.name, lineNumber, line });
      // Guard against zero-length matches causing an infinite loop
      if (match.index === pattern.regex.lastIndex) {
        pattern.regex.lastIndex += 1;
      }
    }
  }
  return violations;
}

let exitCode = 0;

// Allow explicit paths (useful for manual checks); default to the migration dirs.
const cliTargets = process.argv.slice(2);
const targets = cliTargets.length > 0 ? cliTargets : MIGRATION_DIRS;

const files = [];
for (const target of targets) {
  const absolute = path.isAbsolute(target) ? target : path.resolve(ROOT, target);
  if (fs.existsSync(absolute) && fs.statSync(absolute).isDirectory()) {
    files.push(...findMigrationFiles(absolute));
  } else if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) {
    files.push(absolute);
  }
}

if (files.length === 0) {
  console.error('ERROR: No migration files found!');
  process.exit(1);
}

for (const file of files) {
  const relativePath = path.relative(ROOT, file);
  const violations = violationsFor(file);
  for (const violation of violations) {
    console.error(
      `FAIL: ${relativePath}:${violation.lineNumber} — opens a separate connection via '${violation.pattern}':`,
    );
    console.error(`      ${violation.line}`);
    console.error(
      `      Migrations run in one shared transaction; use the QueryRunner passed to up()/down() instead.`,
    );
    exitCode = 1;
  }
}

if (exitCode === 0) {
  console.log(`PASS: All ${files.length} migration files use only the passed queryRunner`);
}

process.exit(exitCode);
