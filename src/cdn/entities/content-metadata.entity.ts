import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum ContentType {
  IMAGE = 'image',
  VIDEO = 'video',
  DOCUMENT = 'document',
  AUDIO = 'audio',
}

export enum ContentStatus {
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  OPTIMIZED = 'optimized',
  READY = 'ready',
  FAILED = 'failed',
}

@Entity('content_metadata')
@Index(['contentId'], { unique: true })
@Index(['status'])
@Index(['contentType'])
export class ContentMetadata {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'content_id', unique: true })
  contentId: string;

  @Column({ name: 'original_url' })
  originalUrl: string;

  @Column({ name: 'cdn_url', nullable: true })
  cdnUrl: string;

  @Column({
    name: 'content_type',
    type: 'enum',
    enum: ContentType,
  })
  contentType: ContentType;

  @Column({ name: 'file_name' })
  fileName: string;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column({ name: 'file_size' })
  fileSize: number;

  @Column({ name: 'optimized_size', nullable: true })
  optimizedSize: number;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ContentStatus,
    default: ContentStatus.UPLOADING,
  })
  status: ContentStatus;

  @Column({ name: 'etag', nullable: true })
  etag: string;

  @Column({ name: 'provider', default: 'cloudflare' })
  provider: string;

  @Column({ name: 'optimization_settings', type: 'json', nullable: true })
  optimizationSettings: {
    width?: number;
    height?: number;
    quality?: number;
    format?: string;
    responsive?: boolean;
  };

  @Column({ name: 'variants', type: 'json', nullable: true })
  variants: Array<{
    name: string;
    url: string;
    width: number;
    height: number;
    size: number;
  }>;

  @Column({ name: 'metadata', type: 'json', nullable: true })
  metadata: {
    width?: number;
    height?: number;
    duration?: number; // for video/audio
    bitrate?: number;
    codec?: string;
  };

  @Column({ name: 'owner_id', nullable: true })
  ownerId?: string;

  @Column({ name: 'tenant_id', nullable: true })
  tenantId?: string;

  @Column({ name: 'error_message', nullable: true })
  errorMessage: string;

  @Column({ name: 'retry_count', default: 0 })
  retryCount: number;

  @Column({ name: 'last_accessed_at', nullable: true })
  lastAccessedAt: Date;

  @Column({ name: 'access_count', default: 0 })
  accessCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
