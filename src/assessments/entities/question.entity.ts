import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm"
import { Assessment } from "./assessment.entity"
import { QuestionOption } from "./question-option.entity"

export enum QuestionType {
  MULTIPLE_CHOICE = "multiple_choice",
  TRUE_FALSE = "true_false",
  SHORT_ANSWER = "short_answer",
  CODING_CHALLENGE = "coding_challenge",
}

export enum QuestionDifficulty {
  EASY = "easy",
  MEDIUM = "medium",
  HARD = "hard",
}

@Entity("questions")
export class Question {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column()
  assessmentId: string

  @ManyToOne(
    () => Assessment,
    (assessment) => assessment.questions,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "assessmentId" })
  assessment: Assessment

  @Column({
    type: "enum",
    enum: QuestionType,
  })
  type: QuestionType

  @Column({ type: "text" })
  questionText: string

  @Column({ type: "text", nullable: true })
  explanation: string

  @Column({ type: "decimal", precision: 5, scale: 2, default: 1 })
  points: number

  @Column({
    type: "enum",
    enum: QuestionDifficulty,
    default: QuestionDifficulty.MEDIUM,
  })
  difficulty: QuestionDifficulty

  @Column({ type: "int", default: 0 })
  orderIndex: number

  @Column({ type: "json", nullable: true })
  metadata: Record<string, any> // For coding challenges, additional config

  @OneToMany(
    () => QuestionOption,
    (option) => option.question,
    { cascade: true },
  )
  options: QuestionOption[]

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
