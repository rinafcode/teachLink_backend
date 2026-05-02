import { Injectable, Logger } from '@nestjs/common';
import { IMigrationConfig } from '../migration.service';

/**
 * Migration 006 — Create migrations tracking table
 *
 * up:   Creates the `migrations` table used by MigrationService to track
 *       which migrations have been applied.
 * down: Drops the `migrations` table.
 *
 * NOTE: This migration is intentionally self-referential — it creates the
 * table that tracks itself. Run this first via a raw DB script or a
 * bootstrap mechanism before the migration runner starts.
 */
@Injectable()
export class CreateMigrationsTrackingTableMigration implements IMigrationConfig {
  name = '006-create-migrations-tracking-table';
  version = '1.0.0';
  dependencies: string[] = [];

  private readonly logger = new Logger(CreateMigrationsTrackingTableMigration.name);

  /**
   * Executes up.
   * @param connection The connection.
   */
  async up(connection: any): Promise<void> {
    this.logger.log('Applying migration: create migrations tracking table');

    await connection.query(`
      DO $$ BEGIN
        CREATE TYPE migration_status AS ENUM ('pending', 'completed', 'failed', 'rolled_back');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
        await connection.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name            VARCHAR(255) NOT NULL UNIQUE,
        version         VARCHAR(50) NOT NULL,
        status          migration_status NOT NULL DEFAULT 'pending',
        applied_at      TIMESTAMP,
        rolled_back_at  TIMESTAMP,
        error_message   TEXT,
        created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    this.logger.log('Migration applied: create migrations tracking table');
  }

  /**
   * Executes down.
   * @param connection The connection.
   */
  async down(connection: any): Promise<void> {
    this.logger.log('Rolling back migration: create migrations tracking table');

    await connection.query('DROP TABLE IF EXISTS migrations CASCADE;');
    await connection.query('DROP TYPE IF EXISTS migration_status;');

    this.logger.log('Migration rolled back: create migrations tracking table');
  }
}
