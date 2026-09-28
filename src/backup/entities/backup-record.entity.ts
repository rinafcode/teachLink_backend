import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  VersionColumn,
} from 'typeorm';

import { BackupStatus } from '../enums/backup-status.enum';
import { BackupType } from '../enums/backup-type.enum';
import { Region } from '../enums/region.enum';

/**
 * Stronger metadata typing (clean separation of concerns)
 */
type BackupMetadata = {
  pgVersion?: string;
  tableCounts?: Record<string, number>;
  totalRows?: number;

  timing?: {
    startTime?: Date;
    endTime?: Date;
    dumpDuration?: number;
    uploadDuration?: number;
    encryptionDuration?: number;
    replicationDuration?: number;
  };
};

@Entity('backup_records')
@Index(['status', 'createdAt'])
@Index(['region'])
@Index(['completedAt'])
export class BackupRecord {
  // =========================
  // CORE IDENTITY
  // =========================
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  // =========================
  // BACKUP CONFIG
  // =========================
  @Column({ type: 'enum', enum: BackupType, default: BackupType.FULL })
  backupType: BackupType;

  @Column({ type: 'enum', enum: BackupStatus, default: BackupStatus.PENDING })
  status: BackupStatus;

  @Column({ type: 'enum', enum: Region })
  region: Region;

  @Column()
  databaseName: string;

  // =========================
  // STORAGE LAYER
  // =========================
  @Column()
  storageKey: string;

  @Column({ nullable: true })
  encryptedStorageKey?: string;

  @Column({ nullable: true })
  replicatedStorageKey?: string;

  @Column({ nullable: true })
  kmsKeyId?: string;

  // =========================
  // SIZE + INTEGRITY
  // =========================
  @Column({ type: 'bigint', nullable: true })
  backupSizeBytes?: number;

  @Column({ nullable: true })
  checksumMd5?: string;

  @Column({ nullable: true })
  checksumSha256?: string;

  @Column({ default: false })
  integrityVerified: boolean;

  @Column({ nullable: true })
  verifiedAt?: Date;

  // =========================
  // STATUS CONTROL
  // =========================
  @Column({ default: 0 })
  retryCount: number;

  @Column({ nullable: true })
  errorMessage?: string;

  @Column({ nullable: true })
  completedAt?: Date;

  @Column({ nullable: true })
  expiresAt?: Date;

  // =========================
  // METADATA (structured)
  // =========================
  @Column({ type: 'json', nullable: true })
  metadata?: BackupMetadata;

  // =========================
  // TIMESTAMPS
  // =========================
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  // =====================================================
  // 🧠 BUSINESS LOGIC LAYER (NEW)
  // =====================================================

  /**
   * Check if backup is completed
   */
  isCompleted(): boolean {
    return this.status === BackupStatus.COMPLETED;
  }

  /**
   * Check if backup failed
   */
  isFailed(): boolean {
    return this.status === BackupStatus.FAILED;
  }

  /**
   * Check if backup is still running
   */
  isActive(): boolean {
    return this.status === BackupStatus.PENDING || this.status === BackupStatus.IN_PROGRESS;
  }

  /**
   * Mark backup as completed safely
   */
  markCompleted(): void {
    this.status = BackupStatus.COMPLETED;
    this.completedAt = new Date();

    this.metadata = {
      ...this.metadata,
      timing: {
        ...this.metadata?.timing,
        endTime: new Date(),
      },
    };
  }

  /**
   * Mark failure with error tracking
   */
  markFailed(error: string): void {
    this.status = BackupStatus.FAILED;
    this.errorMessage = error;
    this.retryCount += 1;
  }

  /**
   * Increment retry safely
   */
  incrementRetry(): void {
    this.retryCount = (this.retryCount ?? 0) + 1;
  }

  /**
   * Verify integrity
   */
  verifyIntegrity(): void {
    this.integrityVerified = true;
    this.verifiedAt = new Date();
  }

  // =====================================================
  // 🏭 FACTORY METHODS (NEW)
  // =====================================================

  static createFullBackup(params: {
    databaseName: string;
    region: Region;
    storageKey: string;
    kmsKeyId?: string;
  }): BackupRecord {
    const record = new BackupRecord();

    record.backupType = BackupType.FULL;
    record.status = BackupStatus.PENDING;
    record.databaseName = params.databaseName;
    record.region = params.region;
    record.storageKey = params.storageKey;
    record.kmsKeyId = params.kmsKeyId;

    record.retryCount = 0;
    record.integrityVerified = false;

    record.metadata = {
      timing: {
        startTime: new Date(),
      },
    };

    return record;
  }

  static createIncrementalBackup(params: {
    databaseName: string;
    region: Region;
    storageKey: string;
  }): BackupRecord {
    const record = new BackupRecord();

    record.backupType = BackupType.INCREMENTAL;
    record.status = BackupStatus.PENDING;
    record.databaseName = params.databaseName;
    record.region = params.region;
    record.storageKey = params.storageKey;

    record.retryCount = 0;

    return record;
  }

  // =====================================================
  // 📊 COMPUTED PROPERTIES
  // =====================================================

  /**
   * Human-readable size
   */
  get readableSize(): string {
    if (!this.backupSizeBytes) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = this.backupSizeBytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Progress-like estimation (simple heuristic)
   */
  get healthScore(): number {
    let score = 100;

    if (this.isFailed()) score -= 70;
    if (this.retryCount > 0) score -= this.retryCount * 10;
    if (!this.integrityVerified) score -= 10;

    return Math.max(0, Math.min(100, score));
  }
}
