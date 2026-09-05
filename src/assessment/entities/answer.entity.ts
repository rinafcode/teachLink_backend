import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn, VersionColumn } from 'typeorm';
import { AssessmentAttempt } from './assessment-attempt.entity';
import { Question } from './question.entity';
/**
 * Represents the answer entity.
 */
@Entity()
// Composite index for the common "answers of an attempt" lookup and
// the "answer for a given question within an attempt" lookup. Because the
// leading column is `attempt`, this also serves attempt-only filters, so a
// separate single-column index on `attempt` would be redundant.
@Index('IDX_answer_attempt_question', ['attempt', 'question'])
@Index('IDX_answer_question', ['question'])
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
