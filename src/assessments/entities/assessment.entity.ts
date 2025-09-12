import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Question } from './question.entity';
import { AssessmentAttempt } from './assessment-attempt.entity';

export enum AssessmentType {
  QUIZ = 'quiz',
  EXAM = 'exam',
  PRACTICE = 'practice',
  ASSIGNMENT = 'assignment',
}

export enum AssessmentStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

@Entity('assessments')
export class Assessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: AssessmentType,
    default: AssessmentType.QUIZ,
  })
  type: AssessmentType;

  @Column({
    type: 'enum',
    enum: AssessmentStatus,
    default: AssessmentStatus.DRAFT,
  })
  status: AssessmentStatus;

  @Column({ nullable: true })
  courseId: string;

  @Column()
  createdBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdBy' })
  creator: User;

  @Column({ type: 'int', nullable: true })
  timeLimit: number; // in minutes

  @Column({ type: 'int', default: 1 })
  maxAttempts: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  passingScore: number;

  @Column({ type: 'boolean', default: false })
  shuffleQuestions: boolean;

  @Column({ type: 'boolean', default: false })
  showCorrectAnswers: boolean;

  @Column({ type: 'boolean', default: true })
  allowReview: boolean;

  @Column({ type: 'timestamp', nullable: true })
  availableFrom: Date;

  @Column({ type: 'timestamp', nullable: true })
  availableUntil: Date;

  @OneToMany(() => Question, (question) => question.assessment, {
    cascade: true,
  })
  questions: Question[];

  @OneToMany(() => AssessmentAttempt, (attempt) => attempt.assessment)
  attempts: AssessmentAttempt[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
