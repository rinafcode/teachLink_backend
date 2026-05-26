import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  VersionColumn,
} from 'typeorm';
import { AssessmentStatus } from '../enums/assessment-status.enum';
import { Answer } from './answer.entity';
import { Assessment } from './assessment.entity';

/**
 * Represents the assessment Attempt entity.
 */
@Entity()
export class AssessmentAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @Column()
  studentId: string;

  @ManyToOne(() => Assessment)
  assessment: Assessment;

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
