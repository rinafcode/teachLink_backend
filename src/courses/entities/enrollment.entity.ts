import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  VersionColumn,
  DeleteDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Course } from './course.entity';

/**
 * Represents the enrollment entity.
 */
@Entity()
@Index(['userId', 'status'])
@Index(['courseId', 'status'])
@Index(['userId', 'enrolledAt'])
@Index(['courseId', 'enrolledAt'])
// Partial unique index (userId, courseId) WHERE "deletedAt" IS NULL, created by
// migration 1799000000000. A plain unique index would also cover soft-deleted
// rows and block re-enrollment after unenroll; the partial predicate excludes
// them. The `where` predicate mirrors the migration so the schema drift check
// (migration:generate --check) stays green.
@Index('UQ_enrollments_active_user_course', ['userId', 'courseId'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
export class Enrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @ManyToOne(() => User, (user) => user.enrollments, { onDelete: 'CASCADE' })
  user: User;

  @Column({ name: 'user_id' })
  @Index()
  userId: string;

  @ManyToOne(() => Course, (course) => course.enrollments, { onDelete: 'CASCADE' })
  course: Course;

  @Column({ name: 'course_id' })
  @Index()
  courseId: string;

  @Column({ type: 'float', default: 0 })
  progress: number; // 0 to 100

  @Column({ default: 'active' }) // active, completed, dropped
  @Index()
  status: string;

  @CreateDateColumn()
  @Index()
  enrolledAt: Date;

  @UpdateDateColumn()
  lastAccessedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
