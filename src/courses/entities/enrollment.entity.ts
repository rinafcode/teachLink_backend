import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  VersionColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Course } from './course.entity';

/**
 * Represents the enrollment entity.
 */
@Entity()
@Index(['userId', 'status'])
@Index(['courseId', 'status'])
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
  enrolledAt: Date;

  @UpdateDateColumn()
  lastAccessedAt: Date;
}
