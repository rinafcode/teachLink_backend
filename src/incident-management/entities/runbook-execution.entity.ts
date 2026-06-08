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

export enum RunbookExecutionStatus {
  SCHEDULED = 'scheduled',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PARTIALLY_COMPLETED = 'partially_completed',
}

@Entity('runbook_executions')
@Index(['incidentId', 'status'])
@Index(['startedAt'])
export class RunbookExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  incidentId: string;

  @ManyToOne(() => Incident, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'incidentId' })
  incident: Incident;

  @Column()
  runbookName: string; // e.g., 'database-failure', 'region-outage'

  @Column('text')
  runbookPath: string; // path to the runbook file

  @Column({
    type: 'enum',
    enum: RunbookExecutionStatus,
    default: RunbookExecutionStatus.SCHEDULED,
  })
  status: RunbookExecutionStatus;

  @Column({ nullable: true })
  startedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @Column('jsonb', { nullable: true })
  stepExecutions: Array<{
    stepNumber: number;
    stepName: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    output?: string;
    error?: string;
  }>;

  @Column('text', { nullable: true })
  executionSummary: string;

  @Column('text', { nullable: true })
  errorDetails: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
