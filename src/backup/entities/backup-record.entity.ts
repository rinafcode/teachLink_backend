import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { BackupStatus } from '../enums/backup-status.enum';
import { BackupType } from '../enums/backup-type.enum';
import { Region } from '../enums/region.enum';

@Entity('backup_records')
@Index(['status', 'createdAt'])
@Index(['region'])
@Index(['completedAt'])
export class BackupRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: BackupType, default: BackupType.FULL })
  backupType: BackupType;

  @Column({ type: 'enum', enum: BackupStatus, default: BackupStatus.PENDING })
  status: BackupStatus;

  @Column({ type: 'enum', enum: Region })
  region: Region;

  @Column()
  databaseName: string;

  @Column()
  storageKey: string;

  @Column({ nullable: true })
  encryptedStorageKey: string;

  @Column({ nullable: true })
  replicatedStorageKey: string;

  @Column({ nullable: true })
  kmsKeyId: string;

  @Column({ type: 'bigint', nullable: true })
  backupSizeBytes: number;

  @Column({ type: 'json', nullable: true })
  metadata: {
    pgVersion?: string;
    tableCounts?: Record<string, number>;
    totalRows?: number;
    startTime?: Date;
    endTime?: Date;
    dumpDuration?: number;
    uploadDuration?: number;
    encryptionDuration?: number;
    replicationDuration?: number;
  };

  @Column({ nullable: true })
  errorMessage: string;

  @Column({ default: 0 })
  retryCount: number;

  @Column({ nullable: true })
  checksumMd5: string;

  @Column({ nullable: true })
  checksumSha256: string;

  @Column({ default: false })
  integrityVerified: boolean;

  @Column({ nullable: true })
  verifiedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @Column({ nullable: true })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
