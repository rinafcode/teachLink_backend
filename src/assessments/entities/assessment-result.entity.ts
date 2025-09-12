import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AssessmentAttempt } from './assessment-attempt.entity';
import { Question } from './question.entity';

@Entity('assessment_results')
export class AssessmentResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  attemptId: string;

  @ManyToOne(() => AssessmentAttempt, (attempt) => attempt.results, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'attemptId' })
  attempt: AssessmentAttempt;

  @Column()
  questionId: string;

  @ManyToOne(() => Question)
  @JoinColumn({ name: 'questionId' })
  question: Question;

  @Column({ type: 'json' })
  userAnswer: any;

  @Column({ type: 'json', nullable: true })
  correctAnswer: any;

  @Column({ type: 'boolean', default: false })
  isCorrect: boolean;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  pointsEarned: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  pointsPossible: number;

  @Column({ type: 'text', nullable: true })
  feedback: string;

  @Column({ type: 'int', nullable: true })
  timeSpent: number; // in seconds
}
