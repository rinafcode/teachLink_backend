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
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { CourseModule } from './course-module.entity';
import { Enrollment } from './enrollment.entity';

@Entity()
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

  @Column({ default: 'draft' }) // draft, published, archived
  @Index()
  status: string;

  @Column({ nullable: true })
  thumbnailUrl: string;

  @ManyToOne(() => User, (user) => user.courses)
  instructor: User;

  @Column({ name: 'instructor_id' })
  @Index()
  instructorId: string;

  @OneToMany(() => CourseModule, (module) => module.course)
  modules: CourseModule[];

  @OneToMany(() => Enrollment, (enrollment) => enrollment.course)
  enrollments: Enrollment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
