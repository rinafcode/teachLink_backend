import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum MigrationStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back',
}

export enum MigrationType {
  SCHEMA = 'schema',
  DATA = 'data',
  INDEX = 'index',
  CONSTRAINT = 'constraint',
  VIEW = 'view',
  PROCEDURE = 'procedure',
}

@Entity('migrations')
@Index(['version'])
@Index(['environment', 'status'])
@Index(['timestamp'])
export class Migration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  version: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: MigrationType })
  type: MigrationType;

  @Column({
    type: 'enum',
    enum: MigrationStatus,
    default: MigrationStatus.PENDING,
  })
  status: MigrationStatus;

  @Column()
  environment: string;

  @Column({ name: 'file_path' })
  filePath: string;

  @Column({ type: 'text', name: 'up_sql' })
  upSql: string;

  @Column({ type: 'text', name: 'down_sql' })
  downSql: string;

  @Column({ type: 'jsonb', nullable: true })
  dependencies: string[];

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ name: 'checksum' })
  checksum: string;

  @Column({ name: 'executed_by', nullable: true })
  executedBy: string;

  @Column({ name: 'execution_time', type: 'int', nullable: true })
  executionTime: number;

  @Column({ type: 'text', nullable: true })
  error: string;

  @Column({ name: 'rollback_version', nullable: true })
  rollbackVersion: string;

  @Column({ name: 'conflict_resolution', type: 'jsonb', nullable: true })
  conflictResolution: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'timestamp', name: 'timestamp' })
  @Index()
  timestamp: Date;

  @Column({ name: 'executed_at', type: 'timestamp', nullable: true })
  executedAt: Date;

  @Column({ name: 'rolled_back_at', type: 'timestamp', nullable: true })
  rolledBackAt: Date;
}
