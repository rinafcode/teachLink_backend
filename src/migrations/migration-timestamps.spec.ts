import * as fs from 'fs';
import * as path from 'path';

/**
 * Issue #1196 — Duplicate migration timestamps caused ambiguous ordering.
 *
 * TypeORM orders migrations by their numeric timestamp prefix. Two files
 * sharing a timestamp make their relative order depend on filesystem
 * load order, which is not guaranteed to be stable across platforms/CI
 * runners. This spec guards against that class of bug for every migration
 * under `src/migrations`, and pins down the specific renumbering done for
 * #1196.
 */
describe('src/migrations timestamps', () => {
  const migrationsDir = __dirname;

  // Mirrors the `migrations` glob in src/config/datasource.ts
  // (`src/migrations/[0-9]*`): a migration file's basename starts with a digit.
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((name) => /^[0-9].*\.ts$/.test(name) && !name.endsWith('.spec.ts'));

  interface ParsedMigration {
    file: string;
    timestamp: string;
    className: string;
  }

  function parseMigration(file: string): ParsedMigration {
    const match = file.match(/^(\d+)-.*\.ts$/);
    if (!match) {
      throw new Error(`Migration file "${file}" does not start with a numeric timestamp`);
    }
    const timestamp = match[1];

    const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const classMatch = content.match(/export class (\w+) implements MigrationInterface/);
    if (!classMatch) {
      throw new Error(`Could not find an exported MigrationInterface class in "${file}"`);
    }

    return { file, timestamp, className: classMatch[1] };
  }

  const migrations = migrationFiles.map(parseMigration);

  it('finds at least the migrations under test', () => {
    expect(migrations.length).toBeGreaterThan(0);
  });

  it('has no two migration files sharing the same timestamp', () => {
    const seen = new Map<string, string[]>();
    for (const { file, timestamp } of migrations) {
      const existing = seen.get(timestamp) ?? [];
      existing.push(file);
      seen.set(timestamp, existing);
    }

    const duplicates = [...seen.entries()].filter(([, files]) => files.length > 1);

    expect(duplicates).toEqual([]);
  });

  it('names every migration class with its own file timestamp as a suffix (TypeORM derives the recorded migration name from the class)', () => {
    const mismatched = migrations.filter(
      ({ timestamp, className }) => !className.endsWith(timestamp),
    );

    expect(mismatched).toEqual([]);
  });

  it('gives every migration class an explicit `name` field (when present) that matches the class name', () => {
    for (const { file, className } of migrations) {
      const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const nameFieldMatch = content.match(/^\s*name\s*=\s*'([^']+)'/m);
      if (nameFieldMatch) {
        expect(nameFieldMatch[1]).toBe(className);
      }
    }
  });

  describe('issue #1196 regression: previously-duplicated timestamp pairs', () => {
    it('add-course-full-text-search and clear-legacy-bcrypt-refresh-tokens no longer share 1783000000003', () => {
      expect(
        fs.existsSync(path.join(migrationsDir, '1783000000003-add-course-full-text-search.ts')),
      ).toBe(true);
      expect(
        fs.existsSync(
          path.join(migrationsDir, '1783000000006-clear-legacy-bcrypt-refresh-tokens.ts'),
        ),
      ).toBe(true);
      expect(
        fs.existsSync(
          path.join(migrationsDir, '1783000000003-clear-legacy-bcrypt-refresh-tokens.ts'),
        ),
      ).toBe(false);

      // The clear-legacy-bcrypt migration performs a data UPDATE and must not
      // race, or be interleaved with, the DDL-only full-text-search migration.
      const fullTextSearch = migrations.find((m) =>
        m.file.endsWith('add-course-full-text-search.ts'),
      );
      const clearLegacyBcrypt = migrations.find((m) =>
        m.file.endsWith('clear-legacy-bcrypt-refresh-tokens.ts'),
      );

      expect(fullTextSearch).toBeDefined();
      expect(clearLegacyBcrypt).toBeDefined();
      expect(Number(clearLegacyBcrypt!.timestamp)).toBeGreaterThan(
        Number(fullTextSearch!.timestamp),
      );
    });

    it('add-paused-subscription-status and fix-invoice-number-sequence no longer share 1790000000000', () => {
      expect(
        fs.existsSync(path.join(migrationsDir, '1790000000000-add-paused-subscription-status.ts')),
      ).toBe(true);
      expect(
        fs.existsSync(path.join(migrationsDir, '1790000000001-fix-invoice-number-sequence.ts')),
      ).toBe(true);
      expect(
        fs.existsSync(path.join(migrationsDir, '1790000000000-fix-invoice-number-sequence.ts')),
      ).toBe(false);
    });

    it('add-invoice-tax-columns and reconcile-schema-drift no longer share 1796000000000', () => {
      expect(
        fs.existsSync(path.join(migrationsDir, '1796000000000-add-invoice-tax-columns.ts')),
      ).toBe(true);
      expect(
        fs.existsSync(path.join(migrationsDir, '1796000000001-reconcile-schema-drift.ts')),
      ).toBe(true);
      expect(
        fs.existsSync(path.join(migrationsDir, '1796000000000-reconcile-schema-drift.ts')),
      ).toBe(false);
    });
  });
});
