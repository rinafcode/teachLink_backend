import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum SyncEventType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  BULK_UPDATE = 'bulk_update',
}

export enum SyncStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

export enum DataSource {
  PRIMARY_DB = 'primary_db',
  SECONDARY_DB = 'secondary_db',
  CACHE = 'cache',
  SEARCH_INDEX = 'search_index',
  EXTERNAL_API = 'external_api',
}

@Entity('sync_events')
@Index(['entityType', 'entityId'])
@Index(['status', 'createdAt'])
@Index(['dataSource', 'region'])
export class SyncEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  entityType: string;

  @Column()
  entityId: string;

  @Column({
    type: 'enum',
    enum: SyncEventType,
  })
  eventType: SyncEventType;

  @Column({
    type: 'enum',
    enum: DataSource,
  })
  dataSource: DataSource;

  @Column()
  region: string;

  @Column({
    type: 'enum',
    enum: SyncStatus,
    default: SyncStatus.PENDING,
  })
  status: SyncStatus;

  @Column('jsonb')
  payload: Record<string, any>;

  @Column('jsonb', { nullable: true })
  previousData: Record<string, any>;

  @Column('bigint')
  version: number;

  @Column('timestamp')
  timestamp: Date;

  @Column('int', { default: 0 })
  retryCount: number;

  @Column('int', { default: 3 })
  maxRetries: number;

  @Column('text', { nullable: true })
  errorMessage: string;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
