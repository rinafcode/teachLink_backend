import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { VideoProcessingJob } from './video-processing-job.entity';
import { VideoVariant } from './video-variant.entity';

export enum VideoStatus {
  UPLOADED = 'uploaded',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  ARCHIVED = 'archived',
}

export enum VideoType {
  COURSE_CONTENT = 'course_content',
  PROMOTIONAL = 'promotional',
  LIVE_STREAM = 'live_stream',
  USER_GENERATED = 'user_generated',
}

@Entity('videos')
@Index(['status', 'createdAt'])
@Index(['type', 'status'])
export class Video {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 500 })
  originalFilePath: string;

  @Column({ type: 'varchar', length: 100 })
  originalFileName: string;

  @Column({ type: 'bigint' })
  originalFileSize: number;

  @Column({ type: 'varchar', length: 50 })
  originalMimeType: string;

  @Column({
    type: 'enum',
    enum: VideoStatus,
    default: VideoStatus.UPLOADED,
  })
  status: VideoStatus;

  @Column({
    type: 'enum',
    enum: VideoType,
    default: VideoType.COURSE_CONTENT,
  })
  type: VideoType;

  @Column({ type: 'int', nullable: true })
  duration: number; // in seconds

  @Column({ type: 'int', nullable: true })
  width: number;

  @Column({ type: 'int', nullable: true })
  height: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  frameRate: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  codec: string;

  @Column({ type: 'bigint', nullable: true })
  bitrate: number;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'varchar', length: 500, nullable: true })
  thumbnailPath: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  previewPath: string;

  @Column({ type: 'uuid', nullable: true })
  courseId: string;

  @Column({ type: 'uuid', nullable: true })
  uploadedBy: string;

  @Column({ type: 'text', nullable: true })
  processingError: string;

  @Column({ type: 'int', default: 0 })
  processingProgress: number; // 0-100

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => VideoProcessingJob, (job) => job.video, {
    cascade: true,
  })
  processingJobs: VideoProcessingJob[];

  @OneToMany(() => VideoVariant, (variant) => variant.video, {
    cascade: true,
  })
  variants: VideoVariant[];
}
