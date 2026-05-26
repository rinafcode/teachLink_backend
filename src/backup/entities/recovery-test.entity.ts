import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
  VersionColumn,
} from 'typeorm';
import { RecoveryTestStatus } from '../enums/recovery-test-status.enum';
import { BackupRecord } from './backup-record.entity';

/**
 * Represents the recovery Test entity.
 */
@Entity('recovery_tests')
@Index(['status', 'createdAt'])
@Index(['backupRecordId'])
@Index(['testCompletedAt'])
export class RecoveryTest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @Column({ name: 'backup_record_id' })
  backupRecordId: string;

  @ManyToOne(() => BackupRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'backup_record_id' })
  backupRecord: BackupRecord;

  @Column({
    type: 'enum',
    enum: RecoveryTestStatus,
    default: RecoveryTestStatus.PENDING,
  })
  status: RecoveryTestStatus;

  @Column()
  testDatabaseName: string;

  @Column({ type: 'json', nullable: true })
  validationResults: {
    tableCountMatch?: boolean;
    rowCountMatch?: boolean;
    checksumMatch?: boolean;
    schemaValid?: boolean;
    connectionSuccessful?: boolean;
    queriesExecuted?: number;
    errors?: string[];
  };

  @Column({ type: 'json', nullable: true })
  performanceMetrics: {
    downloadDuration?: number;
    decryptionDuration?: number;
    restoreDuration?: number;
    validationDuration?: number;
    totalDuration?: number;
  };

  @Column({ nullable: true })
  errorMessage: string;

  @Column({ default: 0 })
  retryCount: number;

  @Column({ nullable: true })
  testCompletedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
