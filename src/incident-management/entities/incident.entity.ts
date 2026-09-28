import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum IncidentStatus {
  DETECTED = 'detected',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  ESCALATED = 'escalated',
  FAILED = 'failed',
}

export enum IncidentSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

@Entity('incidents')
@Index(['status', 'severity'])
@Index(['detectedAt'])
export class Incident {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column({
    type: 'enum',
    enum: IncidentStatus,
    default: IncidentStatus.DETECTED,
  })
  status: IncidentStatus;

  @Column({
    type: 'enum',
    enum: IncidentSeverity,
  })
  severity: IncidentSeverity;

  @Column({ type: 'jsonb', nullable: true })
  triggerMetrics: Record<string, unknown>;

  @Column({ nullable: true })
  runbookId: string;

  @Column('simple-array', { nullable: true })
  remediationActionIds: string[];

  @Column({ nullable: true })
  escalatedTo: string;

  @Column({ nullable: true })
  resolvedAt: Date;

  @Column('text', { nullable: true })
  resolutionNotes: string;

  @CreateDateColumn()
  detectedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
