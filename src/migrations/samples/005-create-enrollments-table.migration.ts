import { Injectable, Logger } from '@nestjs/common';
import { IMigrationConfig } from '../migration.service';

/**
 * Migration 005 — Create enrollment table
 *
 * up:   Creates the `enrollment` table with FKs to users and course.
 * down: Drops the `enrollment` table.
 *
 * Depends on: 001-create-users-table, 002-create-courses-table
 */
@Injectable()
export class CreateEnrollmentsTableMigration implements IMigrationConfig {
  name = '005-create-enrollments-table';
  version = '1.0.0';
  dependencies = ['001-create-users-table', '002-create-courses-table'];

  private readonly logger = new Logger(CreateEnrollmentsTableMigration.name);

  async up(connection: any): Promise<void> {
    this.logger.log('Applying migration: create enrollment table');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS enrollment (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        course_id        UUID NOT NULL REFERENCES course(id) ON DELETE CASCADE,
        progress         FLOAT NOT NULL DEFAULT 0,
        status           VARCHAR(50) NOT NULL DEFAULT 'active',
        enrolled_at      TIMESTAMP NOT NULL DEFAULT NOW(),
        last_accessed_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await connection.query(
      'CREATE INDEX IF NOT EXISTS idx_enrollment_user_id   ON enrollment (user_id);',
    );
    await connection.query(
      'CREATE INDEX IF NOT EXISTS idx_enrollment_course_id ON enrollment (course_id);',
    );
    await connection.query(
      'CREATE INDEX IF NOT EXISTS idx_enrollment_status    ON enrollment (status);',
    );
    await connection.query(
      'CREATE INDEX IF NOT EXISTS idx_enrollment_user_status   ON enrollment (user_id, status);',
    );
    await connection.query(
      'CREATE INDEX IF NOT EXISTS idx_enrollment_course_status ON enrollment (course_id, status);',
    );

    this.logger.log('Migration applied: create enrollment table');
  }

  async down(connection: any): Promise<void> {
    this.logger.log('Rolling back migration: create enrollment table');

    await connection.query('DROP TABLE IF EXISTS enrollment CASCADE;');

    this.logger.log('Migration rolled back: create enrollment table');
  }
}
