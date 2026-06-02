import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Incident } from './incident.entity';

export enum RemediationStatus {
  QUEUED = 'queued',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back',
}

@Entity('remediation_actions')
@Index(['incidentId', 'status'])
@Index(['executedAt'])
export class RemediationAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  incidentId: string;

  @ManyToOne(() => Incident, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incidentId' })
  incident: Incident;

  @Column()
  actionType: string; // e.g., 'restart_service', 'scale_up_pods', 'clear_cache'

  @Column('text')
  description: string;

  @Column({
    type: 'enum',
    enum: RemediationStatus,
    default: RemediationStatus.QUEUED,
  })
  status: RemediationStatus;

  @Column({ type: 'jsonb', nullable: true })
  parameters: Record<string, unknown>;

  @Column({ nullable: true })
  executedAt: Date;

  @Column('text', { nullable: true })
  executionOutput: string;

  @Column('text', { nullable: true })
  errorMessage: string;

  @Column({ default: false })
  autoRollback: boolean;

  @Column({ nullable: true })
  rolledBackAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
