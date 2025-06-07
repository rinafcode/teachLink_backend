import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from "typeorm"
import { Course } from "../../entities/course.entity"

@Entity("enrollments")
export class Enrollment {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @ManyToOne(
    () => Course,
    (course) => course.enrollments,
    { onDelete: "CASCADE" },
  )
  course: Course

  @Column()
  courseId: string

  @Column()
  userId: string

  @Column({ default: 0 })
  progress: number

  @Column({ default: false })
  completed: boolean

  @Column({ type: "jsonb", default: {} })
  lessonProgress: Record<string, boolean>

  @Column({ nullable: true })
  rating: number

  @Column({ type: "text", nullable: true })
  review: string

  @CreateDateColumn()
  enrolledAt: Date

  @Column({ nullable: true })
  completedAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
