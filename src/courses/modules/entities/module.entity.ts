import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm"
import { Course } from "../../entities/course.entity"
import { Lesson } from "../../lessons/entities/lesson.entity"

@Entity("modules")
export class Module {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column()
  title: string

  @Column("text", { nullable: true })
  description: string

  @Column()
  order: number

  @ManyToOne(
    () => Course,
    (course) => course.modules,
    { onDelete: "CASCADE" },
  )
  course: Course

  @Column()
  courseId: string

  @OneToMany(
    () => Lesson,
    (lesson) => lesson.module,
    { cascade: true },
  )
  lessons: Lesson[]

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
