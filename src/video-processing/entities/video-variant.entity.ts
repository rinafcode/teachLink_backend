import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm"
import { Video } from "./video.entity"

export enum VideoQuality {
  ULTRA_LOW = "240p",
  LOW = "360p",
  MEDIUM = "480p",
  HIGH = "720p",
  FULL_HD = "1080p",
  QUAD_HD = "1440p",
  ULTRA_HD = "2160p",
}

export enum VideoFormat {
  MP4 = "mp4",
  WEBM = "webm",
  HLS = "hls",
  DASH = "dash",
}

export enum VariantStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
}

@Entity("video_variants")
@Index(["videoId", "quality", "format"])
@Index(["status", "createdAt"])
export class VideoVariant {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ type: "uuid" })
  videoId: string

  @Column({
    type: "enum",
    enum: VideoQuality,
  })
  quality: VideoQuality

  @Column({
    type: "enum",
    enum: VideoFormat,
  })
  format: VideoFormat

  @Column({
    type: "enum",
    enum: VariantStatus,
    default: VariantStatus.PENDING,
  })
  status: VariantStatus

  @Column({ type: "varchar", length: 500 })
  filePath: string

  @Column({ type: "bigint", nullable: true })
  fileSize: number

  @Column({ type: "bigint", nullable: true })
  bitrate: number

  @Column({ type: "int", nullable: true })
  width: number

  @Column({ type: "int", nullable: true })
  height: number

  @Column({ type: "varchar", length: 50, nullable: true })
  codec: string

  @Column({ type: "json", nullable: true })
  processingSettings: Record<string, any>

  @Column({ type: "text", nullable: true })
  processingError: string

  @Column({ type: "int", default: 0 })
  processingProgress: number // 0-100

  @Column({ type: "timestamp", nullable: true })
  processingStartedAt: Date

  @Column({ type: "timestamp", nullable: true })
  processingCompletedAt: Date

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  @ManyToOne(
    () => Video,
    (video) => video.variants,
    {
      onDelete: "CASCADE",
    },
  )
  @JoinColumn({ name: "videoId" })
  video: Video
}
