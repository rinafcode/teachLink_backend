import { Injectable, Logger } from "@nestjs/common"
import type { Repository } from "typeorm"
import { type VideoProcessingJob, JobType } from "../entities/video-processing-job.entity"
import type { MetadataService } from "./metadata.service"
import type { ThumbnailService } from "./thumbnail.service"
import type { FFmpegService } from "./ffmpeg.service"

@Injectable()
export class WorkerService {
  private readonly logger = new Logger(WorkerService.name)
  private readonly cancelledJobs = new Set<string>()

  constructor(
    private readonly jobRepository: Repository<VideoProcessingJob>,
    private readonly metadataService: MetadataService,
    private readonly thumbnailService: ThumbnailService,
    private readonly ffmpegService: FFmpegService,
  ) {}

  async processJob(job: VideoProcessingJob): Promise<any> {
    this.logger.log(`Processing job ${job.id} of type ${job.type}`)

    if (this.cancelledJobs.has(job.id)) {
      throw new Error("Job was cancelled")
    }

    try {
      let result: any

      switch (job.type) {
        case JobType.METADATA_EXTRACTION:
          result = await this.processMetadataExtraction(job)
          break
        case JobType.THUMBNAIL_GENERATION:
          result = await this.processThumbnailGeneration(job)
          break
        case JobType.PREVIEW_GENERATION:
          result = await this.processPreviewGeneration(job)
          break
        case JobType.TRANSCODE:
          result = await this.processTranscode(job)
          break
        case JobType.QUALITY_ANALYSIS:
          result = await this.processQualityAnalysis(job)
          break
        case JobType.ADAPTIVE_STREAMING:
          result = await this.processAdaptiveStreaming(job)
          break
        default:
          throw new Error(`Unknown job type: ${job.type}`)
      }

      this.logger.log(`Job ${job.id} processed successfully`)
      return result
    } catch (error) {
      this.logger.error(`Job ${job.id} processing failed`, error.stack)
      throw error
    } finally {
      this.cancelledJobs.delete(job.id)
    }
  }

  async cancelJob(jobId: string): Promise<void> {
    this.cancelledJobs.add(jobId)
    this.logger.log(`Job ${jobId} marked for cancellation`)
  }

  private async processMetadataExtraction(job: VideoProcessingJob): Promise<any> {
    const { video } = job
    if (!video) {
      throw new Error("Video not found for metadata extraction job")
    }

    await this.updateJobProgress(job.id, 10)

    const metadata = await this.metadataService.extractMetadata(video.originalFilePath)

    await this.updateJobProgress(job.id, 100)

    return {
      metadata,
      duration: metadata.duration,
      width: metadata.width,
      height: metadata.height,
      frameRate: metadata.frameRate,
      codec: metadata.codec,
      bitrate: metadata.bitrate,
    }
  }

  private async processThumbnailGeneration(job: VideoProcessingJob): Promise<any> {
    const { video } = job
    if (!video) {
      throw new Error("Video not found for thumbnail generation job")
    }

    await this.updateJobProgress(job.id, 10)

    const parameters = job.parameters || {}
    const timestamps = parameters.timestamps || [10, 25, 50, 75, 90]

    const thumbnails = await this.thumbnailService.generateThumbnails(video.originalFilePath, video.id, timestamps)

    await this.updateJobProgress(job.id, 100)

    return {
      thumbnails,
      count: thumbnails.length,
    }
  }

  private async processPreviewGeneration(job: VideoProcessingJob): Promise<any> {
    const { video } = job
    if (!video) {
      throw new Error("Video not found for preview generation job")
    }

    await this.updateJobProgress(job.id, 10)

    const parameters = job.parameters || {}
    const duration = parameters.duration || 30

    const previewPath = await this.thumbnailService.generatePreview(video.originalFilePath, video.id, duration)

    await this.updateJobProgress(job.id, 100)

    return {
      previewPath,
      duration,
    }
  }

  private async processTranscode(job: VideoProcessingJob): Promise<any> {
    const { video } = job
    if (!video) {
      throw new Error("Video not found for transcode job")
    }

    const parameters = job.parameters || {}
    const { quality, format } = parameters

    if (!quality || !format) {
      throw new Error("Quality and format parameters are required for transcode job")
    }

    await this.updateJobProgress(job.id, 5)

    // Get encoding settings
    const encodingSettings = this.getEncodingSettings(quality, format)
    const outputPath = `processed/${video.id}/${quality}.${format}`

    // Process video with progress callback
    const result = await this.ffmpegService.transcode(
      video.originalFilePath,
      outputPath,
      encodingSettings,
      async (progress) => {
        if (this.cancelledJobs.has(job.id)) {
          throw new Error("Job was cancelled")
        }
        await this.updateJobProgress(job.id, Math.min(5 + Math.floor(progress * 0.9), 95))
      },
    )

    await this.updateJobProgress(job.id, 100)

    return {
      outputPath: result.outputPath,
      fileSize: result.fileSize,
      duration: result.duration,
      bitrate: result.bitrate,
      width: result.width,
      height: result.height,
      codec: result.codec,
      quality,
      format,
    }
  }

  private async processQualityAnalysis(job: VideoProcessingJob): Promise<any> {
    const { video } = job
    if (!video) {
      throw new Error("Video not found for quality analysis job")
    }

    await this.updateJobProgress(job.id, 10)

    // Analyze video quality metrics
    const metadata = await this.metadataService.extractMetadata(video.originalFilePath)

    await this.updateJobProgress(job.id, 50)

    // Calculate quality score based on various factors
    const qualityScore = this.calculateQualityScore(metadata)

    await this.updateJobProgress(job.id, 100)

    return {
      qualityScore,
      resolution: `${metadata.width}x${metadata.height}`,
      bitrate: metadata.bitrate,
      frameRate: metadata.frameRate,
      codec: metadata.codec,
      recommendations: this.generateQualityRecommendations(metadata),
    }
  }

  private async processAdaptiveStreaming(job: VideoProcessingJob): Promise<any> {
    const { video } = job
    if (!video) {
      throw new Error("Video not found for adaptive streaming job")
    }

    await this.updateJobProgress(job.id, 10)

    // Find all completed MP4 variants for this video
    const variants = video.variants?.filter((v) => v.format === "mp4" && v.status === "completed") || []

    if (variants.length === 0) {
      throw new Error("No completed MP4 variants found for adaptive streaming")
    }

    await this.updateJobProgress(job.id, 30)

    // Generate HLS manifest
    const hlsPath = `streaming/${video.id}/hls/master.m3u8`
    await this.ffmpegService.generateHLS(
      variants.map((v) => v.filePath),
      hlsPath,
    )

    await this.updateJobProgress(job.id, 65)

    // Generate DASH manifest
    const dashPath = `streaming/${video.id}/dash/manifest.mpd`
    await this.ffmpegService.generateDASH(
      variants.map((v) => v.filePath),
      dashPath,
    )

    await this.updateJobProgress(job.id, 100)

    return {
      hlsPath,
      dashPath,
      variantCount: variants.length,
    }
  }

  private getEncodingSettings(quality: string, format: string) {
    const settings = {
      "240p": { width: 426, height: 240, bitrate: "400k", crf: 28 },
      "360p": { width: 640, height: 360, bitrate: "800k", crf: 26 },
      "480p": { width: 854, height: 480, bitrate: "1200k", crf: 24 },
      "720p": { width: 1280, height: 720, bitrate: "2500k", crf: 22 },
      "1080p": { width: 1920, height: 1080, bitrate: "4000k", crf: 20 },
      "1440p": { width: 2560, height: 1440, bitrate: "8000k", crf: 18 },
      "2160p": { width: 3840, height: 2160, bitrate: "15000k", crf: 16 },
    }

    const formatSettings = {
      mp4: { codec: "libx264", container: "mp4" },
      webm: { codec: "libvpx-vp9", container: "webm" },
    }

    return {
      ...settings[quality],
      ...formatSettings[format],
    }
  }

  private calculateQualityScore(metadata: any): number {
    let score = 100

    // Penalize low resolution
    const pixelCount = metadata.width * metadata.height
    if (pixelCount < 640 * 360) score -= 30
    else if (pixelCount < 1280 * 720) score -= 15
    else if (pixelCount < 1920 * 1080) score -= 5

    // Penalize low bitrate
    const bitrateKbps = metadata.bitrate / 1000
    if (bitrateKbps < 500) score -= 25
    else if (bitrateKbps < 1000) score -= 15
    else if (bitrateKbps < 2000) score -= 5

    // Penalize low frame rate
    if (metadata.frameRate < 24) score -= 20
    else if (metadata.frameRate < 30) score -= 10

    return Math.max(0, Math.min(100, score))
  }

  private generateQualityRecommendations(metadata: any): string[] {
    const recommendations: string[] = []

    const pixelCount = metadata.width * metadata.height
    const bitrateKbps = metadata.bitrate / 1000

    if (pixelCount < 1280 * 720) {
      recommendations.push("Consider uploading higher resolution content (720p or above)")
    }

    if (bitrateKbps < 1000) {
      recommendations.push("Increase bitrate for better quality")
    }

    if (metadata.frameRate < 30) {
      recommendations.push("Consider using 30fps or higher for smoother playback")
    }

    if (metadata.codec !== "h264" && metadata.codec !== "h265") {
      recommendations.push("Use H.264 or H.265 codec for better compatibility")
    }

    return recommendations
  }

  private async updateJobProgress(jobId: string, progress: number): Promise<void> {
    await this.jobRepository.update(jobId, { progress })
  }
}
