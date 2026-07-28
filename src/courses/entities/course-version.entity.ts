import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Course, CourseStatus } from './course.entity';
import { User } from '../../users/entities/user.entity';

export enum CourseVersionEventType {
  CREATED = 'created',
  UPDATED = 'updated',
  ROLLEDBACK = 'rolled_back',
}

@Entity('course_versions')
@Index(['courseId', 'versionNumber'], { unique: true })
export class CourseVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Course, (course) => course.versions, { onDelete: 'CASCADE' })
  course: Course;

  @Column({ name: 'course_id' })
  @Index()
  courseId: string;

  @Column({ type: 'int' })
  versionNumber: number;

  @Column({ type: 'enum', enum: CourseVersionEventType })
  eventType: CourseVersionEventType;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  changedBy: User;

  @Column({ name: 'changed_by_user_id', nullable: true })
  changedByUserId?: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ nullable: true })
  thumbnailUrl?: string;

  @Column({
    type: 'enum',
    enum: CourseStatus,
  })
  status: CourseStatus;

  @Column({ type: 'text', nullable: true })
  submissionNote?: string;

  @Column({ type: 'jsonb', nullable: true })
  changes?: Record<string, { previous: unknown; next: unknown }>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
