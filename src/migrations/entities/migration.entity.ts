import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

/**
 * TypeORM's internal `migrations` table.
 *
 * Tracks which migrations have been applied. TypeORM queries this table by
 * `name` (to check whether a migration has already run) and orders by
 * `timestamp` (to determine the order in which migrations are applied).
 *
 * Index strategy:
 *   - `name`      — TypeORM looks up applied migrations by name on every
 *                   `migration:run` / `migration:revert`.
 *   - `timestamp` — migrations are ordered by timestamp to determine the
 *                   next pending migration.
 */
@Entity('migrations')
@Index('IDX_migrations_name', ['name'])
@Index('IDX_migrations_timestamp', ['timestamp'])
export class Migration {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('bigint')
  timestamp: number;

  @Column()
  name: string;
}
