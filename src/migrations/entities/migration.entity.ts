import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum MigrationStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back'
}

@Entity({ name: 'migrations' })
export class Migration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column()
  version: string;

  @Column({
    type: 'enum',
    enum: MigrationStatus,
    default: MigrationStatus.PENDING
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