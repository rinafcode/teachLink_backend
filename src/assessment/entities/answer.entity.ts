import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, VersionColumn } from 'typeorm';
import { AssessmentAttempt } from './assessment-attempt.entity';
import { Question } from './question.entity';
/**
 * Represents the answer entity.
 */
@Entity()
export class Answer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @ManyToOne(() => AssessmentAttempt, (a) => a.answers)
  attempt: AssessmentAttempt;

  @ManyToOne(() => Question)
  question: Question;

  @Column({ type: 'json' })
  response: string | any;

  @Column({ nullable: true })
  awardedPoints?: number;
}
