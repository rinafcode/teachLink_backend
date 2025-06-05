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
import { User } from "../../users/entities/user.entity"
import { Assessment } from "./assessment.entity"
import { AssessmentResult } from "./assessment-result.entity"

export enum AttemptStatus {
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  ABANDONED = "abandoned",
  TIME_EXPIRED = "time_expired",
}

@Entity("assessment_attempts")
export class AssessmentAttempt {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column()
  assessmentId: string

  @ManyToOne(
    () => Assessment,
    (assessment) => assessment.attempts,
  )
  @JoinColumn({ name: "assessmentId" })
  assessment: Assessment

  @Column()
  userId: string

  @ManyToOne(() => User)
  @JoinColumn({ name: "userId" })
  user: User

  @Column({ type: "int", default: 1 })
  attemptNumber: number

  @Column({
    type: "enum",
    enum: AttemptStatus,
    default: AttemptStatus.IN_PROGRESS,
  })
  status: AttemptStatus

  @Column({ type: "timestamp", nullable: true })
  startedAt: Date

  @Column({ type: "timestamp", nullable: true })
  completedAt: Date

  @Column({ type: "int", nullable: true })
  timeSpent: number // in seconds

  @Column({ type: "decimal", precision: 5, scale: 2, nullable: true })
  score: number

  @Column({ type: "decimal", precision: 5, scale: 2, nullable: true })
  percentage: number

  @Column({ type: "boolean", default: false })
  passed: boolean

  @Column({ type: "json", nullable: true })
  answers: Record<string, any> // questionId -> answer

  @OneToMany(
    () => AssessmentResult,
    (result) => result.attempt,
    { cascade: true },
  )
  results: AssessmentResult[]

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
