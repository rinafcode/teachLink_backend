import { Injectable, Logger } from "@nestjs/common"
import type { Repository } from "typeorm"
import { type VideoProcessingJob, JobStatus, JobType } from "../entities/video-processing-job.entity"
import { type Video, VideoStatus } from "../entities/video.entity"
import type { ProcessingQueue } from "../entities/processing-queue.entity"

export interface SystemMetrics {
  totalVideos: number
  processingVideos: number
  completedVideos: number
  failedVideos: number
  totalJobs: number
  queuedJobs: number
  processingJobs: number
  completedJobs: number
  failedJobs: number
  averageProcessingTime: number
  systemLoad: number
  queueHealth: QueueHealth[]
}

export interface QueueHealth {
  queueName: string
  status: string
  activeJobs: number
  maxJobs: number
  utilizationPercent: number
  avgWaitTime: number
}

export interface JobTypeMetrics {
  type: JobType
  total: number
  completed: number
  failed: number
  averageTime: number
  successRate: number
}

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name)

  constructor(
    private readonly videoRepository: Repository<Video>,
    private readonly jobRepository: Repository<VideoProcessingJob>,
    private readonly queueRepository: Repository<ProcessingQueue>,
  ) {}

  async getSystemMetrics(): Promise<SystemMetrics> {
    const [
      totalVideos,
      processingVideos,
      completedVideos,
      failedVideos,
      totalJobs,
      queuedJobs,
      processingJobs,
      completedJobs,
      failedJobs,
    ] = await Promise.all([
      this.videoRepository.count(),
      this.videoRepository.count({ where: { status: VideoStatus.PROCESSING } }),
      this.videoRepository.count({ where: { status: VideoStatus.COMPLETED } }),
      this.videoRepository.count({ where: { status: VideoStatus.FAILED } }),
      this.jobRepository.count(),
      this.jobRepository.count({ where: { status: JobStatus.QUEUED } }),
      this.jobRepository.count({ where: { status: JobStatus.PROCESSING } }),
      this.jobRepository.count({ where: { status: JobStatus.COMPLETED } }),
      this.jobRepository.count({ where: { status: JobStatus.FAILED } }),
    ])

    const averageProcessingTime = await this.calculateAverageProcessingTime()
    const systemLoad = this.calculateSystemLoad(processingJobs, totalJobs)
    const queueHealth = await this.getQueueHealth()

    return {
      totalVideos,
      processingVideos,
      completedVideos,
      failedVideos,
      totalJobs,
      queuedJobs,
      processingJobs,
      completedJobs,
      failedJobs,
      averageProcessingTime,
      systemLoad,
      queueHealth,
    }
  }

  async getJobTypeMetrics(): Promise<JobTypeMetrics[]> {
    const jobTypes = Object.values(JobType)
    const metrics: JobTypeMetrics[] = []

    for (const type of jobTypes) {
      const [total, completed, failed] = await Promise.all([
        this.jobRepository.count({ where: { type } }),
        this.jobRepository.count({ where: { type, status: JobStatus.COMPLETED } }),
        this.jobRepository.count({ where: { type, status: JobStatus.FAILED } }),
      ])

      const averageTime = await this.calculateAverageProcessingTimeByType(type)
      const successRate = total > 0 ? (completed / total) * 100 : 0

      metrics.push({
        type,
        total,
        completed,
        failed,
        averageTime,
        successRate,
      })
    }

    return metrics
  }

  async getProcessingTrends(days = 7): Promise<any> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const dailyStats = await this.jobRepository
      .createQueryBuilder("job")
      .select("DATE(job.completedAt)", "date")
      .addSelect("COUNT(*)", "totalJobs")
      .addSelect("SUM(CASE WHEN job.status = 'completed' THEN 1 ELSE 0 END)", "completedJobs")
      .addSelect("SUM(CASE WHEN job.status = 'failed' THEN 1 ELSE 0 END)", "failedJobs")
      .addSelect("AVG(job.actualDuration)", "avgDuration")
      .where("job.completedAt >= :startDate", { startDate })
      .groupBy("DATE(job.completedAt)")
      .orderBy("date", "ASC")
      .getRawMany()

    return dailyStats.map((stat) => ({
      date: stat.date,
      totalJobs: Number.parseInt(stat.totalJobs),
      completedJobs: Number.parseInt(stat.completedJobs),
      failedJobs: Number.parseInt(stat.failedJobs),
      avgDuration: Number.parseFloat(stat.avgDuration) || 0,
      successRate: stat.totalJobs > 0 ? (stat.completedJobs / stat.totalJobs) * 100 : 0,
    }))
  }

  async getErrorAnalysis(): Promise<any> {
    const failedJobs = await this.jobRepository.find({
      where: { status: JobStatus.FAILED },
      select: ["type", "error", "createdAt"],
      order: { createdAt: "DESC" },
      take: 100,
    })

    const errorGroups = new Map<string, { count: number; jobs: any[] }>()

    for (const job of failedJobs) {
      const errorKey = this.categorizeError(job.error || "Unknown error")
      if (!errorGroups.has(errorKey)) {
        errorGroups.set(errorKey, { count: 0, jobs: [] })
      }
      const group = errorGroups.get(errorKey)!
      group.count++
      group.jobs.push({
        id: job.id,
        type: job.type,
        error: job.error,
        createdAt: job.createdAt,
      })
    }

    return Array.from(errorGroups.entries()).map(([error, data]) => ({
      error,
      count: data.count,
      percentage: (data.count / failedJobs.length) * 100,
      recentJobs: data.jobs.slice(0, 5),
    }))
  }

  private async calculateAverageProcessingTime(): Promise<number> {
    const result = await this.jobRepository
      .createQueryBuilder("job")
      .select("AVG(job.actualDuration)", "avgDuration")
      .where("job.status = :status", { status: JobStatus.COMPLETED })
      .andWhere("job.actualDuration IS NOT NULL")
      .getRawOne()

    return Number.parseFloat(result?.avgDuration) || 0
  }

  private async calculateAverageProcessingTimeByType(type: JobType): Promise<number> {
    const result = await this.jobRepository
      .createQueryBuilder("job")
      .select("AVG(job.actualDuration)", "avgDuration")
      .where("job.status = :status", { status: JobStatus.COMPLETED })
      .andWhere("job.type = :type", { type })
      .andWhere("job.actualDuration IS NOT NULL")
      .getRawOne()

    return Number.parseFloat(result?.avgDuration) || 0
  }

  private calculateSystemLoad(processingJobs: number, totalJobs: number): number {
    if (totalJobs === 0) return 0
    return Math.min((processingJobs / Math.max(totalJobs * 0.1, 1)) * 100, 100)
  }

  private async getQueueHealth(): Promise<QueueHealth[]> {
    const queues = await this.queueRepository.find()
    const health: QueueHealth[] = []

    for (const queue of queues) {
      const utilizationPercent =
        queue.maxConcurrentJobs > 0 ? (queue.currentActiveJobs / queue.maxConcurrentJobs) * 100 : 0

      // Calculate average wait time (simplified)
      const avgWaitTime = await this.calculateAverageWaitTime(queue.name)

      health.push({
        queueName: queue.name,
        status: queue.status,
        activeJobs: queue.currentActiveJobs,
        maxJobs: queue.maxConcurrentJobs,
        utilizationPercent,
        avgWaitTime,
      })
    }

    return health
  }

  private async calculateAverageWaitTime(queueName: string): Promise<number> {
    // This is a simplified calculation
    // In a real implementation, you'd track queue wait times more precisely
    const recentJobs = await this.jobRepository.find({
      where: { status: JobStatus.COMPLETED },
      order: { completedAt: "DESC" },
      take: 50,
    })

    const waitTimes = recentJobs
      .filter((job) => job.startedAt && job.scheduledAt)
      .map((job) => job.startedAt!.getTime() - job.scheduledAt!.getTime())

    return waitTimes.length > 0 ? waitTimes.reduce((sum, time) => sum + time, 0) / waitTimes.length / 1000 : 0
  }

  private categorizeError(error: string): string {
    if (error.includes("FFmpeg")) return "FFmpeg Error"
    if (error.includes("timeout") || error.includes("timed out")) return "Timeout Error"
    if (error.includes("file") || error.includes("path")) return "File System Error"
    if (error.includes("memory") || error.includes("space")) return "Resource Error"
    if (error.includes("cancelled")) return "Cancellation"
    return "Other Error"
  }

  async getHealthCheck(): Promise<{ status: string; details: any }> {
    try {
      const metrics = await this.getSystemMetrics()
      const isHealthy = metrics.systemLoad < 90 && metrics.failedJobs < metrics.totalJobs * 0.1

      return {
        status: isHealthy ? "healthy" : "degraded",
        details: {
          systemLoad: metrics.systemLoad,
          failureRate: metrics.totalJobs > 0 ? (metrics.failedJobs / metrics.totalJobs) * 100 : 0,
          processingVideos: metrics.processingVideos,
          queuedJobs: metrics.queuedJobs,
        },
      }
    } catch (error) {
      return {
        status: "unhealthy",
        details: { error: error.message },
      }
    }
  }
}
