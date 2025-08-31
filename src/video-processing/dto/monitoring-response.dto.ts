import { ApiProperty } from "@nestjs/swagger"
import { JobType } from "../entities/video-processing-job.entity"

export class QueueHealthDto {
  @ApiProperty({ example: "high-priority" })
  queueName: string

  @ApiProperty({ example: "active" })
  status: string

  @ApiProperty({ example: 2 })
  activeJobs: number

  @ApiProperty({ example: 5 })
  maxJobs: number

  @ApiProperty({ example: 40 })
  utilizationPercent: number

  @ApiProperty({ example: 120 })
  avgWaitTime: number
}

export class SystemMetricsDto {
  @ApiProperty({ example: 1250 })
  totalVideos: number

  @ApiProperty({ example: 15 })
  processingVideos: number

  @ApiProperty({ example: 1200 })
  completedVideos: number

  @ApiProperty({ example: 35 })
  failedVideos: number

  @ApiProperty({ example: 8500 })
  totalJobs: number

  @ApiProperty({ example: 45 })
  queuedJobs: number

  @ApiProperty({ example: 12 })
  processingJobs: number

  @ApiProperty({ example: 8200 })
  completedJobs: number

  @ApiProperty({ example: 243 })
  failedJobs: number

  @ApiProperty({ example: 180 })
  averageProcessingTime: number

  @ApiProperty({ example: 25.5 })
  systemLoad: number

  @ApiProperty({ type: [QueueHealthDto] })
  queueHealth: QueueHealthDto[]
}

export class JobTypeMetricsDto {
  @ApiProperty({ enum: JobType, example: JobType.TRANSCODE })
  type: JobType

  @ApiProperty({ example: 2500 })
  total: number

  @ApiProperty({ example: 2350 })
  completed: number

  @ApiProperty({ example: 150 })
  failed: number

  @ApiProperty({ example: 240 })
  averageTime: number

  @ApiProperty({ example: 94.0 })
  successRate: number
}

export class ProcessingTrendDto {
  @ApiProperty({ example: "2024-01-15" })
  date: string

  @ApiProperty({ example: 125 })
  totalJobs: number

  @ApiProperty({ example: 118 })
  completedJobs: number

  @ApiProperty({ example: 7 })
  failedJobs: number

  @ApiProperty({ example: 195 })
  avgDuration: number

  @ApiProperty({ example: 94.4 })
  successRate: number
}

export class ErrorAnalysisDto {
  @ApiProperty({ example: "FFmpeg Error" })
  error: string

  @ApiProperty({ example: 45 })
  count: number

  @ApiProperty({ example: 18.5 })
  percentage: number

  @ApiProperty({
    example: [{ id: "job-1", type: "transcode", error: "FFmpeg process failed", createdAt: "2024-01-15T10:00:00Z" }],
  })
  recentJobs: Array<{
    id: string
    type: string
    error: string
    createdAt: Date
  }>
}

export class HealthCheckDto {
  @ApiProperty({ example: "healthy", enum: ["healthy", "degraded", "unhealthy"] })
  status: string

  @ApiProperty({
    example: {
      systemLoad: 25.5,
      failureRate: 2.8,
      processingVideos: 15,
      queuedJobs: 45,
    },
  })
  details: {
    systemLoad: number
    failureRate: number
    processingVideos: number
    queuedJobs: number
  }
}
