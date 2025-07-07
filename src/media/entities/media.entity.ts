import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
  DOCUMENT = 'document',
  AUDIO = 'audio',
}

export enum MediaStatus {
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  READY = 'ready',
  FAILED = 'failed',
}

@Entity('media')
export class Media {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  filename: string;

  @Column()
  originalName: string;

  @Column()
  mimeType: string;

  @Column('bigint')
  size: number;

  @Column({
    type: 'enum',
    enum: MediaType,
  })
  type: MediaType;

  @Column({
    type: 'enum',
    enum: MediaStatus,
    default: MediaStatus.UPLOADING,
  })
  status: MediaStatus;

  @Column()
  storageUrl: string;

  @Column({ nullable: true })
  thumbnailUrl?: string;

  @Column('json', { nullable: true })
  metadata?: {
    duration?: number;
    width?: number;
    height?: number;
    bitrate?: number;
    qualities?: string[];
    pageCount?: number;
    wordCount?: number;
  };

  @Column('json', { nullable: true })
  processingData?: {
    transcodeJobId?: string;
    qualities?: { [key: string]: string };
  };

  @Column()
  uploadedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploadedById' })
  uploadedBy: User;

  @Column({ default: false })
  isRemoved: boolean;

  @Column({ default: false })
  isHidden: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
