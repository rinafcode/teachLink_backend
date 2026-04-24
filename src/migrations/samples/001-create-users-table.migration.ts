import { Injectable, Logger } from '@nestjs/common';
import { MigrationConfig } from '../migration.service';

/**
 * Migration 001 — Create users table
 *
 * up:   Creates the `users` table with all columns, enums, and indexes.
 * down: Drops the `users` table and its associated enum types.
 */
@Injectable()
export class CreateUsersTableMigration implements MigrationConfig {
  name = '001-create-users-table';
  version = '1.0.0';
  dependencies: string[] = [];

  private readonly logger = new Logger(CreateUsersTableMigration.name);

  async up(connection: any): Promise<void> {
    this.logger.log('Applying migration: create users table');

    await connection.query(`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM ('student', 'teacher', 'admin');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await connection.query(`
      DO $$ BEGIN
        CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email                      VARCHAR(255) NOT NULL UNIQUE,
        username                   VARCHAR(100),
        password                   VARCHAR(255) NOT NULL,
        first_name                 VARCHAR(100) NOT NULL,
        last_name                  VARCHAR(100) NOT NULL,
        role                       user_role NOT NULL DEFAULT 'student',
        status                     user_status NOT NULL DEFAULT 'active',
        tenant_id                  VARCHAR(100),
        profile_picture            VARCHAR(500),
        is_email_verified          BOOLEAN NOT NULL DEFAULT FALSE,
        email_verification_token   VARCHAR(255),
        email_verification_expires TIMESTAMP,
        password_reset_token       VARCHAR(255),
        password_reset_expires     TIMESTAMP,
        refresh_token              TEXT,
        password_history           TEXT[] NOT NULL DEFAULT '{}',
        last_login_at              TIMESTAMP,
        created_at                 TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at                 TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await connection.query('CREATE INDEX IF NOT EXISTS idx_users_email     ON users (email);');
    await connection.query('CREATE INDEX IF NOT EXISTS idx_users_username  ON users (username);');
    await connection.query('CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users (tenant_id);');

    this.logger.log('Migration applied: create users table');
  }

  async down(connection: any): Promise<void> {
    this.logger.log('Rolling back migration: create users table');

    await connection.query('DROP TABLE IF EXISTS users CASCADE;');
    await connection.query('DROP TYPE IF EXISTS user_role;');
    await connection.query('DROP TYPE IF EXISTS user_status;');

    this.logger.log('Migration rolled back: create users table');
  }
}
