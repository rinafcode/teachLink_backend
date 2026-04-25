import { Injectable, Logger } from '@nestjs/common';
import { MigrationConfig } from '../migration.service';
/**
 * Migration 004 — Create lesson table
 *
 * up:   Creates the `lesson` table with FK to course_module.
 * down: Drops the `lesson` table.
 *
 * Depends on: 003-create-course-modules-table
 */
@Injectable()
export class CreateLessonsTableMigration implements MigrationConfig {
    name = '004-create-lessons-table';
    version = '1.0.0';
    dependencies = ['003-create-course-modules-table'];
    private readonly logger = new Logger(CreateLessonsTableMigration.name);
    async up(connection: unknown): Promise<void> {
        this.logger.log('Applying migration: create lesson table');
        await connection.query(`
      CREATE TABLE IF NOT EXISTS lesson (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title            VARCHAR(255) NOT NULL,
        content          TEXT,
        video_url        VARCHAR(500),
        "order"          INTEGER NOT NULL DEFAULT 0,
        duration_seconds INTEGER NOT NULL DEFAULT 0,
        module_id        UUID NOT NULL REFERENCES course_module(id) ON DELETE CASCADE
      );
    `);
        await connection.query('CREATE INDEX IF NOT EXISTS idx_lesson_module_id ON lesson (module_id);');
        this.logger.log('Migration applied: create lesson table');
    }
    async down(connection: unknown): Promise<void> {
        this.logger.log('Rolling back migration: create lesson table');
        await connection.query('DROP TABLE IF EXISTS lesson CASCADE;');
        this.logger.log('Migration rolled back: create lesson table');
    }
}
