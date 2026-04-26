import { IMigrationConfig } from './migration.service';
import { CreateUsersTableMigration } from './samples/001-create-users-table.migration';
import { CreateCoursesTableMigration } from './samples/002-create-courses-table.migration';
import { CreateCourseModulesTableMigration } from './samples/003-create-course-modules-table.migration';
import { CreateLessonsTableMigration } from './samples/004-create-lessons-table.migration';
import { CreateEnrollmentsTableMigration } from './samples/005-create-enrollments-table.migration';
import { CreateMigrationsTrackingTableMigration } from './samples/006-create-migrations-tracking-table.migration';

/**
 * Central registry of all migrations in execution order.
 *
 * Rules:
 * - Migrations are executed in the order they appear in this array.
 * - Each migration's `dependencies` array is validated before execution.
 * - To add a new migration: create the file in `samples/`, then append it here.
 * - Never remove or reorder existing entries — only append new ones.
 */
export const MIGRATION_REGISTRY: IMigrationConfig[] = [
  new CreateMigrationsTrackingTableMigration(),
  new CreateUsersTableMigration(),
  new CreateCoursesTableMigration(),
  new CreateCourseModulesTableMigration(),
  new CreateLessonsTableMigration(),
  new CreateEnrollmentsTableMigration(),
];
