import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  VersionColumn,
  Index,
} from 'typeorm';
import { AssessmentStatus } from '../enums/assessment-status.enum';
import { Answer } from './answer.entity';
import { Assessment } from './assessment.entity';

/**
 * Represents the assessment Attempt entity.
 */
@Entity()
@Index('IDX_assessment_attempt_studentId', ['studentId'])
@Index('IDX_assessment_attempt_assessmentId', ['assessmentId'])
@Index('IDX_assessment_attempt_status', ['status'])
@Index('IDX_assessment_attempt_studentId_assessmentId', ['studentId', 'assessmentId'])
export class AssessmentAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @Column()
  studentId: string;

  @ManyToOne(() => Assessment)
  @JoinColumn({ name: 'assessmentId' })
  assessment: Assessment;

  @Column({ name: 'assessmentId', type: 'uuid', nullable: true })
  assessmentId: string | null;

  @Column({ type: 'enum', enum: AssessmentStatus })
  status: AssessmentStatus;

  @Column({ nullable: true })
  score?: number;

  @Column({ type: 'timestamp' })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  submittedAt?: Date;

  @OneToMany(() => Answer, (a) => a.attempt, {
    cascade: true,
  })
  answers: Answer[];
}
