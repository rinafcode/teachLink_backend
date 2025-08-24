import { IsString, IsOptional, IsEnum, IsArray, IsBoolean, IsUUID, MaxLength, MinLength } from "class-validator"
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger"
import { VideoType } from "../entities/video.entity"
import { VideoQuality, VideoFormat } from "../entities/video-variant.entity"
import { JobPriority } from "../entities/video-processing-job.entity"

export class UploadVideoDto {
  @ApiProperty({
    description: "Title of the video",
    example: "Introduction to React Hooks",
    minLength: 1,
    maxLength: 255,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title: string

  @ApiPropertyOptional({
    description: "Description of the video content",
    example: "A comprehensive guide to using React Hooks in modern applications",
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string

  @ApiPropertyOptional({
    description: "Type of video content",
    enum: VideoType,
    example: VideoType.COURSE_CONTENT,
  })
  @IsOptional()
  @IsEnum(VideoType)
  type?: VideoType

  @ApiPropertyOptional({
    description: "Course ID if this video belongs to a course",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsOptional()
  @IsUUID()
  courseId?: string

  @ApiPropertyOptional({
    description: "ID of the user uploading the video",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsOptional()
  @IsUUID()
  uploadedBy?: string
}

export class ProcessVideoDto {
  @ApiPropertyOptional({
    description: "Video qualities to generate",
    enum: VideoQuality,
    isArray: true,
    example: [VideoQuality.HIGH, VideoQuality.MEDIUM, VideoQuality.LOW],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(VideoQuality, { each: true })
  qualities?: VideoQuality[]

  @ApiPropertyOptional({
    description: "Video formats to generate",
    enum: VideoFormat,
    isArray: true,
    example: [VideoFormat.MP4, VideoFormat.WEBM],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(VideoFormat, { each: true })
  formats?: VideoFormat[]

  @ApiPropertyOptional({
    description: "Whether to generate thumbnails",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  generateThumbnails?: boolean

  @ApiPropertyOptional({
    description: "Whether to generate preview clips",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  generatePreviews?: boolean

  @ApiPropertyOptional({
    description: "Whether to enable adaptive streaming (HLS/DASH)",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  enableAdaptiveStreaming?: boolean

  @ApiPropertyOptional({
    description: "Processing priority",
    enum: JobPriority,
    example: JobPriority.NORMAL,
  })
  @IsOptional()
  @IsEnum(JobPriority)
  priority?: JobPriority
}
