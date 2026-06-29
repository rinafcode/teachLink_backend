import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
  DeleteDateColumn,
  VersionColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Check,
  JoinColumn,
} from 'typeorm';
import { CourseModule } from './course-module.entity';

/**
 * Represents an individual lesson within a course module.
 */
@Entity('lessons')
@Check('"order" >= 0')
@Check('"duration_seconds" >= 0')
export class Lesson {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Optimistic locking for concurrent updates.
   */
  @VersionColumn()
  version: number;

  /**
   * Lesson title displayed to learners.
   */
  @Column({
    type: 'varchar',
    length: 255,
  })
  @Index()
  title: string;

  /**
   * Rich text or markdown lesson content.
   */
  @Column({
    type: 'text',
    nullable: true,
  })
  content?: string | null;

  /**
   * Optional video URL for lesson media.
   */
  @Column({
    name: 'video_url',
    type: 'varchar',
    length: 2048,
    nullable: true,
  })
  videoUrl?: string | null;

  /**
   * Display order inside a module.
   */
  @Column({
    type: 'integer',
    default: 0,
  })
  @Index()
  order: number;

  /**
   * Lesson duration in seconds.
   */
  @Column({
    name: 'duration_seconds',
    type: 'integer',
    default: 0,
  })
  durationSeconds: number;

  /**
   * Parent module relationship.
   */
  @ManyToOne(() => CourseModule, (module) => module.lessons, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'module_id' })
  module: CourseModule;

  /**
   * Foreign key reference.
   */
  @Column({
    name: 'module_id',
    type: 'uuid',
  })
  @Index()
  moduleId: string;

  /**
   * Creation timestamp.
   */
  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt: Date;

  /**
   * Last update timestamp.
   */
  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
  })
  updatedAt: Date;

  /**
   * Soft deletion timestamp.
   */
  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'timestamptz',
  })
  @Index()
  deletedAt?: Date | null;

  /**
   * Whether the lesson contains video content.
   */
  get hasVideo(): boolean {
    return !!this.videoUrl;
  }

  /**
   * Duration in minutes.
   */
  get durationMinutes(): number {
    return Math.ceil(this.durationSeconds / 60);
  }

  /**
   * Whether the lesson has textual content.
   */
  get hasContent(): boolean {
    return !!this.content?.trim();
  }
}
