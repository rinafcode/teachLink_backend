import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Course } from './course.entity';

@Entity()
export class Enrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.enrollments, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Course, (course) => course.enrollments, { onDelete: 'CASCADE' })
  course: Course;

  @Column({ type: 'float', default: 0 })
  progress: number; // 0 to 100

  @Column({ default: 'active' }) // active, completed, dropped
  status: string;

  @CreateDateColumn()
  enrolledAt: Date;

  @UpdateDateColumn()
  lastAccessedAt: Date;
}
