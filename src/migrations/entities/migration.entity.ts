import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

export enum MigrationStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back',
}

/**
 * Represents the migration entity.
 */
@Entity({ name: 'migrations' })
export class Migration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  lockVersion: number;

  @Column({ unique: true })
  name: string;

  @Column()
  version: string;

  @Column({
    type: 'enum',
    enum: MigrationStatus,
    default: MigrationStatus.PENDING,
  })
  status: MigrationStatus;

  @Column({ nullable: true })
  appliedAt?: Date;

  @Column({ nullable: true })
  rolledBackAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;
}
