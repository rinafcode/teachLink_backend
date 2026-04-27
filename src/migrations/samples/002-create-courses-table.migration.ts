import { Injectable, Logger } from '@nestjs/common';
import { IMigrationConfig } from '../migration.service';

/**
 * Migration 002 — Create courses table
 *
 * up:   Creates the `course` table with FK to users (instructor).
 * down: Drops the `course` table.
 *
 * Depends on: 001-create-users-table
 */
@Injectable()
export class CreateCoursesTableMigration implements IMigrationConfig {
  name = '002-create-courses-table';
  version = '1.0.0';
  dependencies = ['001-create-users-table'];

  private readonly logger = new Logger(CreateCoursesTableMigration.name);

  async up(connection: any): Promise<void> {
    this.logger.log('Applying migration: create courses table');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS course (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title          VARCHAR(255) NOT NULL,
        description    TEXT NOT NULL,
        price          NUMERIC(10, 2) NOT NULL DEFAULT 0,
        status         VARCHAR(50) NOT NULL DEFAULT 'draft',
        thumbnail_url  VARCHAR(500),
        instructor_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await connection.query(
      'CREATE INDEX IF NOT EXISTS idx_course_status        ON course (status);',
    );
    await connection.query(
      'CREATE INDEX IF NOT EXISTS idx_course_instructor_id ON course (instructor_id);',
    );

    this.logger.log('Migration applied: create courses table');
  }

  async down(connection: any): Promise<void> {
    this.logger.log('Rolling back migration: create courses table');

    await connection.query('DROP TABLE IF EXISTS course CASCADE;');

    this.logger.log('Migration rolled back: create courses table');
  }
}
