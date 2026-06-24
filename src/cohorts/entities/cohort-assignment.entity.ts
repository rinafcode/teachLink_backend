import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Cohort } from './cohort.entity';

export enum CohortAssignmentStatus {
  OPEN = 'open',
  CLOSED = 'closed',
}

@Entity('cohort_assignments')
export class CohortAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  cohortId: string;

  @ManyToOne(() => Cohort, (cohort) => cohort.assignments, { onDelete: 'CASCADE' })
  cohort: Cohort;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'timestamp', nullable: true })
  dueDate?: Date;

  @Column({ type: 'enum', enum: CohortAssignmentStatus, default: CohortAssignmentStatus.OPEN })
  status: CohortAssignmentStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
