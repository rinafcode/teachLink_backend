import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Video } from './video.entity';

export enum JobType {
  TRANSCODE = 'transcode',
  THUMBNAIL_GENERATION = 'thumbnail_generation',
  PREVIEW_GENERATION = 'preview_generation',
  METADATA_EXTRACTION = 'metadata_extraction',
  QUALITY_ANALYSIS = 'quality_analysis',
  ADAPTIVE_STREAMING = 'adaptive_streaming',
}

export enum JobStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  RETRYING = 'retrying',
}

export enum JobPriority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 8,
  URGENT = 10,
}

@Entity('video_processing_jobs')
@Index(['status', 'priority', 'createdAt'])
@Index(['videoId', 'type'])
@Index(['status', 'scheduledAt'])
export class VideoProcessingJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  videoId: string;

  @Column({
    type: 'enum',
    enum: JobType,
  })
  type: JobType;

  @Column({
    type: 'enum',
    enum: JobStatus,
    default: JobStatus.QUEUED,
  })
  status: JobStatus;

  @Column({
    type: 'enum',
    enum: JobPriority,
    default: JobPriority.NORMAL,
  })
  priority: JobPriority;

  @Column({ type: 'json', nullable: true })
  parameters: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  result: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  error: string;

  @Column({ type: 'int', default: 0 })
  progress: number; // 0-100

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'int', default: 3 })
  maxRetries: number;

  @Column({ type: 'timestamp', nullable: true })
  scheduledAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  workerId: string;

  @Column({ type: 'int', nullable: true })
  estimatedDuration: number; // in seconds

  @Column({ type: 'int', nullable: true })
  actualDuration: number; // in seconds

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Video, (video) => video.processingJobs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'videoId' })
  video: Video;
}
