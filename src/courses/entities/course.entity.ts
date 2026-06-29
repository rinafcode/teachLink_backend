import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  Index,
  VersionColumn,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { CourseModule } from './course-module.entity';
import { Enrollment } from './enrollment.entity';
import { CourseReview } from './course-review.entity';
import { CourseVersion } from './course-version.entity';

/** Lifecycle states a course can be in. */
export enum CourseStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  CHANGES_REQUESTED = 'changes_requested',
  PUBLISHED = 'published',
  REJECTED = 'rejected',
  ARCHIVED = 'archived',
}

/**
 * Represents the course entity.
 */
@Entity()
@Index(['status', 'createdAt'])
@Index(['instructorId', 'createdAt'])
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @Column()
  @Index()
  title: string;

  @Column('text')
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({
    type: 'enum',
    enum: CourseStatus,
    default: CourseStatus.DRAFT,
  })
  @Index()
  status: CourseStatus;

  @Column({ nullable: true })
  thumbnailUrl: string;

  /** Optional category/tag used for catalog grouping and bulk operations. */
  @Column({ nullable: true })
  @Index()
  category?: string;

  @ManyToOne(() => User, (user) => user.courses)
  instructor: User;

  @Column({ name: 'instructor_id' })
  @Index()
  instructorId: string;

  @OneToMany(() => CourseModule, (module) => module.course)
  modules: CourseModule[];

  @OneToMany(() => Enrollment, (enrollment) => enrollment.course)
  enrollments: Enrollment[];

  @ManyToOne(() => Course, (course) => course.prerequisiteFor, { nullable: true })
  @JoinColumn({ name: 'prerequisite_course_id' })
  prerequisite?: Course;

  @OneToMany(() => Course, (course) => course.prerequisite)
  prerequisiteFor: Course[];

  @OneToMany(() => CourseReview, (review) => review.course, { eager: false })
  reviews: CourseReview[];

  @OneToMany(() => CourseVersion, (version) => version.course)
  versions: CourseVersion[];

  /** The submission note provided by the instructor when submitting for review. */
  @Column({ type: 'text', nullable: true })
  submissionNote?: string;

  @CreateDateColumn()
  @Index()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
