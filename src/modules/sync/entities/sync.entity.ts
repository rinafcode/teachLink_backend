import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  VersionColumn,
} from 'typeorm';

export enum SyncStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CONFLICT = 'conflict',
  FAILED = 'failed',
}

export enum SyncOperation {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
}

/**
 * Tracks synchronisation state for entities that participate in
 * cross-region replication.
 *
 * Index strategy:
 *   • (entityType, entityId) — the most common lookup path when
 *     resolving the sync record for a specific entity.
 *   • (status) — filters for pending / failed / conflicted records.
 *   • (lastModified) — ordered scans for "what changed since …".
 *   • (sourceRegion, status) — regional sync-dashboard queries.
 *   • (version) — conflict-resolution comparisons.
 */
@Entity('sync')
@Index('IDX_sync_entity', ['entityType', 'entityId'])
@Index('IDX_sync_status', ['status'])
@Index('IDX_sync_last_modified', ['lastModified'])
@Index('IDX_sync_source_region_status', ['sourceRegion', 'status'])
@Index('IDX_sync_version', ['version'])
export class Sync {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 128 })
  entityType: string;

  @Column({ name: 'entity_id', type: 'varchar', length: 128 })
  entityId: string;

  @Column({ type: 'enum', enum: SyncOperation })
  operation: SyncOperation;

  @Column({ type: 'enum', enum: SyncStatus, default: SyncStatus.PENDING })
  status: SyncStatus;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ name: 'source_region', type: 'varchar', length: 64 })
  sourceRegion: string;

  @Column({ name: 'target_region', type: 'varchar', length: 64, nullable: true })
  targetRegion: string | null;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount: number;

  @Column({ name: 'max_retries', type: 'int', default: 3 })
  maxRetries: number;

  @Column({ name: 'last_modified', type: 'timestamptz' })
  lastModified: Date;

  @Column({ name: 'next_retry_at', type: 'timestamptz', nullable: true })
  nextRetryAt: Date | null;

  @VersionColumn()
  rowVersion: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
