import { Injectable, Logger } from '@nestjs/common';
import { MigrationConfig } from '../migration.service';

/**
 * Migration 003 — Create course_module table
 *
 * up:   Creates the `course_module` table with FK to course.
 * down: Drops the `course_module` table.
 *
 * Depends on: 002-create-courses-table
 */
@Injectable()
export class CreateCourseModulesTableMigration implements MigrationConfig {
  name = '003-create-course-modules-table';
  version = '1.0.0';
  dependencies = ['002-create-courses-table'];

  private readonly logger = new Logger(CreateCourseModulesTableMigration.name);

  async up(connection: any): Promise<void> {
    this.logger.log('Applying migration: create course_module table');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS course_module (
        id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title     VARCHAR(255) NOT NULL,
        "order"   INTEGER NOT NULL DEFAULT 0,
        course_id UUID NOT NULL REFERENCES course(id) ON DELETE CASCADE
      );
    `);

    await connection.query(`CREATE INDEX IF NOT EXISTS idx_course_module_course_id ON course_module (course_id);`);

    this.logger.log('Migration applied: create course_module table');
  }

  async down(connection: any): Promise<void> {
    this.logger.log('Rolling back migration: create course_module table');

    await connection.query(`DROP TABLE IF EXISTS course_module CASCADE;`);

    this.logger.log('Migration rolled back: create course_module table');
  }
}
