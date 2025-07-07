import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from "typeorm"
import { Module } from "../modules/entities/module.entity"
import { Enrollment } from "../enrollments/entities/enrollment.entity"

@Entity("courses")
export class Course {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column()
  title: string

  @Column("text")
  description: string

  @Column({ nullable: true })
  thumbnail: string

  @Column({ default: false })
  isPublished: boolean

  @Column({ default: 0 })
  price: number

  @Column({ nullable: true })
  duration: string

  @Column({ nullable: true })
  level: string

  @Column({ type: "jsonb", nullable: true })
  requirements: string[]

  @Column({ type: "jsonb", nullable: true })
  learningOutcomes: string[]

  @Column({ nullable: true })
  instructorId: string

  @Column({ default: 0 })
  enrollmentCount: number

  @Column({ default: 0 })
  averageRating: number

  @OneToMany(
    () => Module,
    (module) => module.course,
    { cascade: true },
  )
  modules: Module[]

  @OneToMany(
    () => Enrollment,
    (enrollment) => enrollment.course,
  )
  enrollments: Enrollment[]

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
