import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
  DeleteDateColumn,
  VersionColumn,
} from 'typeorm';
import { CourseModule } from './course-module.entity';

/**
 * Represents the lesson entity.
 */
@Entity()
export class Lesson {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @VersionColumn()
  version: number;

  @Column()
  title: string;

  @Column('text', { nullable: true })
  content: string;

  @Column({ nullable: true })
  videoUrl: string;

  @Column({ type: 'int', default: 0 })
  order: number;

  @Column({ type: 'int', default: 0 })
  durationSeconds: number;

  @ManyToOne(() => CourseModule, (module) => module.lessons, { onDelete: 'CASCADE' })
  module: CourseModule;

  @Column({ name: 'module_id' })
  @Index()
  moduleId: string;

  @DeleteDateColumn()
  deletedAt?: Date;
}
