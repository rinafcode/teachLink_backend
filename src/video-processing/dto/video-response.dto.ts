import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { VideoStatus, VideoType } from "../entities/video.entity"
import { VideoQuality, VideoFormat, VariantStatus } from "../entities/video-variant.entity"
import { JobType, JobStatus, JobPriority } from "../entities/video-processing-job.entity"

export class VideoVariantResponseDto {
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string

  @ApiProperty({ enum: VideoQuality, example: VideoQuality.HIGH })
  quality: VideoQuality

  @ApiProperty({ enum: VideoFormat, example: VideoFormat.MP4 })
  format: VideoFormat

  @ApiProperty({ enum: VariantStatus, example: VariantStatus.COMPLETED })
  status: VariantStatus

  @ApiProperty({ example: "processed/video-id/720p.mp4" })
  filePath: string

  @ApiPropertyOptional({ example: 15728640 })
  fileSize?: number

  @ApiPropertyOptional({ example: 2500000 })
  bitrate?: number

  @ApiPropertyOptional({ example: 1280 })
  width?: number

  @ApiPropertyOptional({ example: 720 })
  height?: number

  @ApiPropertyOptional({ example: "libx264" })
  codec?: string

  @ApiPropertyOptional({ example: 85 })
  processingProgress?: number

  @ApiPropertyOptional({ example: "2024-01-15T10:30:00Z" })
  processingCompletedAt?: Date

  @ApiProperty({ example: "2024-01-15T10:00:00Z" })
  createdAt: Date
}

export class VideoJobResponseDto {
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string

  @ApiProperty({ enum: JobType, example: JobType.TRANSCODE })
  type: JobType

  @ApiProperty({ enum: JobStatus, example: JobStatus.COMPLETED })
  status: JobStatus

  @ApiProperty({ enum: JobPriority, example: JobPriority.NORMAL })
  priority: JobPriority

  @ApiPropertyOptional({ example: 95 })
  progress?: number

  @ApiPropertyOptional({ example: 0 })
  retryCount?: number

  @ApiPropertyOptional({ example: "Processing failed: Invalid codec" })
  error?: string

  @ApiPropertyOptional({ example: "2024-01-15T10:00:00Z" })
  startedAt?: Date

  @ApiPropertyOptional({ example: "2024-01-15T10:30:00Z" })
  completedAt?: Date

  @ApiProperty({ example: "2024-01-15T09:45:00Z" })
  createdAt: Date
}

export class VideoResponseDto {
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string

  @ApiProperty({ example: "Introduction to React Hooks" })
  title: string

  @ApiPropertyOptional({ example: "A comprehensive guide to using React Hooks" })
  description?: string

  @ApiProperty({ example: "uploads/original-video.mp4" })
  originalFilePath: string

  @ApiProperty({ example: "original-video.mp4" })
  originalFileName: string

  @ApiProperty({ example: 52428800 })
  originalFileSize: number

  @ApiProperty({ example: "video/mp4" })
  originalMimeType: string

  @ApiProperty({ enum: VideoStatus, example: VideoStatus.COMPLETED })
  status: VideoStatus

  @ApiProperty({ enum: VideoType, example: VideoType.COURSE_CONTENT })
  type: VideoType

  @ApiPropertyOptional({ example: 1800 })
  duration?: number

  @ApiPropertyOptional({ example: 1920 })
  width?: number

  @ApiPropertyOptional({ example: 1080 })
  height?: number

  @ApiPropertyOptional({ example: 29.97 })
  frameRate?: number

  @ApiPropertyOptional({ example: "h264" })
  codec?: string

  @ApiPropertyOptional({ example: 5000000 })
  bitrate?: number

  @ApiPropertyOptional({ example: "thumbnails/video-id/thumbnail_1.jpg" })
  thumbnailPath?: string

  @ApiPropertyOptional({ example: "previews/video-id/preview.mp4" })
  previewPath?: string

  @ApiPropertyOptional({ example: "123e4567-e89b-12d3-a456-426614174000" })
  courseId?: string

  @ApiPropertyOptional({ example: "123e4567-e89b-12d3-a456-426614174000" })
  uploadedBy?: string

  @ApiProperty({ example: 100 })
  processingProgress: number

  @ApiPropertyOptional({ example: "Processing completed successfully" })
  processingError?: string

  @ApiProperty({ example: "2024-01-15T09:30:00Z" })
  createdAt: Date

  @ApiProperty({ example: "2024-01-15T10:30:00Z" })
  updatedAt: Date

  @ApiPropertyOptional({ type: [VideoVariantResponseDto] })
  variants?: VideoVariantResponseDto[]

  @ApiPropertyOptional({ type: [VideoJobResponseDto] })
  processingJobs?: VideoJobResponseDto[]
}

export class ProcessingStatusResponseDto {
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  videoId: string

  @ApiProperty({ enum: VideoStatus, example: VideoStatus.PROCESSING })
  status: VideoStatus

  @ApiProperty({ example: 75 })
  progress: number

  @ApiProperty({ example: 8 })
  totalJobs: number

  @ApiProperty({ example: 6 })
  completedJobs: number

  @ApiProperty({ example: 0 })
  failedJobs: number

  @ApiProperty({ type: [VideoVariantResponseDto] })
  variants: VideoVariantResponseDto[]

  @ApiProperty({ type: [VideoJobResponseDto] })
  jobs: VideoJobResponseDto[]
}

export class UploadResponseDto {
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  videoId: string

  @ApiProperty({ example: "Video uploaded successfully" })
  message: string

  @ApiProperty({ example: "uploads/123e4567-e89b-12d3-a456-426614174000/original.mp4" })
  filePath: string

  @ApiProperty({ example: 52428800 })
  fileSize: number
}

export class ProcessingResultResponseDto {
  @ApiProperty({ example: true })
  success: boolean

  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  videoId: string

  @ApiProperty({ type: [VideoVariantResponseDto] })
  variants: VideoVariantResponseDto[]

  @ApiPropertyOptional({ example: ["thumbnails/video-id/thumbnail_1.jpg"] })
  thumbnails?: string[]

  @ApiPropertyOptional({ example: ["Failed to generate WEBM format"] })
  errors?: string[]
}
