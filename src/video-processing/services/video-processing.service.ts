import { Injectable, Logger, BadRequestException, InternalServerErrorException } from "@nestjs/common"
import type { Repository } from "typeorm"
import { type Video, VideoStatus } from "../entities/video.entity"
import { type VideoVariant, VideoQuality, VideoFormat, VariantStatus } from "../entities/video-variant.entity"
import { type VideoProcessingJob, JobType, JobStatus, JobPriority } from "../entities/video-processing-job.entity"
import type { FFmpegService } from "./ffmpeg.service"
import type { StorageService } from "./storage.service"
import type { MetadataService } from "./metadata.service"
import type { ThumbnailService } from "./thumbnail.service"
import type { QueueService } from "./queue.service"

export interface ProcessingOptions {
  qualities?: VideoQuality[]
  formats?: VideoFormat[]
  generateThumbnails?: boolean
  generatePreviews?: boolean
  enableAdaptiveStreaming?: boolean
  priority?: JobPriority
}

export interface ProcessingResult {
  success: boolean
  videoId: string
  variants: VideoVariant[]
  thumbnails?: string[]
  errors?: string[]
}

@Injectable()
export class VideoProcessingService {
  private readonly logger = new Logger(VideoProcessingService.name)

  constructor(
    private readonly videoRepository: Repository<Video>,
    private readonly variantRepository: Repository<VideoVariant>,
    private readonly jobRepository: Repository<VideoProcessingJob>,
    private readonly ffmpegService: FFmpegService,
    private readonly storageService: StorageService,
    private readonly metadataService: MetadataService,
    private readonly thumbnailService: ThumbnailService,
    private readonly queueService: QueueService,
  ) {}

  async processVideo(videoId: string, options: ProcessingOptions = {}): Promise<ProcessingResult> {
    this.logger.log(`Starting video processing for video: ${videoId}`)

    const video = await this.videoRepository.findOne({
      where: { id: videoId },
      relations: ["variants", "processingJobs"],
    })

    if (!video) {
      throw new BadRequestException(`Video with ID ${videoId} not found`)
    }

    if (video.status === VideoStatus.PROCESSING) {
      throw new BadRequestException(`Video ${videoId} is already being processed`)
    }

    try {
      // Update video status
      await this.updateVideoStatus(videoId, VideoStatus.PROCESSING)

      // Extract metadata first
      const metadata = await this.metadataService.extractMetadata(video.originalFilePath)
      await this.updateVideoMetadata(videoId, metadata)

      // Create processing jobs
      const jobs = await this.createProcessingJobs(video, options)

      // Queue jobs for processing
      await this.queueJobs(jobs)

      // Start processing pipeline
      const result = await this.executeProcessingPipeline(video, options)

      await this.updateVideoStatus(videoId, VideoStatus.COMPLETED)
      this.logger.log(`Video processing completed for video: ${videoId}`)

      return result
    } catch (error) {
      this.logger.error(`Video processing failed for video: ${videoId}`, error.stack)
      await this.updateVideoStatus(videoId, VideoStatus.FAILED, error.message)
      throw new InternalServerErrorException(`Video processing failed: ${error.message}`)
    }
  }

  private async executeProcessingPipeline(video: Video, options: ProcessingOptions): Promise<ProcessingResult> {
    const result: ProcessingResult = {
      success: true,
      videoId: video.id,
      variants: [],
      thumbnails: [],
      errors: [],
    }

    const qualities = options.qualities || [VideoQuality.HIGH, VideoQuality.MEDIUM, VideoQuality.LOW]
    const formats = options.formats || [VideoFormat.MP4, VideoFormat.WEBM]

    // Process each quality/format combination
    for (const quality of qualities) {
      for (const format of formats) {
        try {
          const variant = await this.processVariant(video, quality, format)
          result.variants.push(variant)
        } catch (error) {
          this.logger.error(`Failed to process variant ${quality}/${format}`, error.stack)
          result.errors.push(`${quality}/${format}: ${error.message}`)
        }
      }
    }

    // Generate thumbnails
    if (options.generateThumbnails !== false) {
      try {
        const thumbnails = await this.thumbnailService.generateThumbnails(video.originalFilePath, video.id)
        result.thumbnails = thumbnails
        await this.updateVideoThumbnail(video.id, thumbnails[0])
      } catch (error) {
        this.logger.error(`Failed to generate thumbnails`, error.stack)
        result.errors.push(`Thumbnails: ${error.message}`)
      }
    }

    // Generate adaptive streaming manifests
    if (options.enableAdaptiveStreaming) {
      try {
        await this.generateAdaptiveStreaming(video, result.variants)
      } catch (error) {
        this.logger.error(`Failed to generate adaptive streaming`, error.stack)
        result.errors.push(`Adaptive streaming: ${error.message}`)
      }
    }

    result.success = result.errors.length === 0
    return result
  }

  private async processVariant(video: Video, quality: VideoQuality, format: VideoFormat): Promise<VideoVariant> {
    this.logger.log(`Processing variant: ${quality}/${format} for video ${video.id}`)

    // Create variant record
    const variant = this.variantRepository.create({
      videoId: video.id,
      quality,
      format,
      status: VariantStatus.PROCESSING,
      filePath: await this.generateVariantPath(video.id, quality, format),
    })

    await this.variantRepository.save(variant)

    try {
      // Get encoding settings for quality/format
      const encodingSettings = this.getEncodingSettings(quality, format)

      // Process video with FFmpeg
      const processingResult = await this.ffmpegService.transcode(
        video.originalFilePath,
        variant.filePath,
        encodingSettings,
        (progress) => this.updateVariantProgress(variant.id, progress),
      )

      // Update variant with processing results
      variant.status = VariantStatus.COMPLETED
      variant.fileSize = processingResult.fileSize
      variant.bitrate = processingResult.bitrate
      variant.width = processingResult.width
      variant.height = processingResult.height
      variant.codec = processingResult.codec
      variant.processingCompletedAt = new Date()

      await this.variantRepository.save(variant)

      this.logger.log(`Variant processing completed: ${quality}/${format} for video ${video.id}`)
      return variant
    } catch (error) {
      variant.status = VariantStatus.FAILED
      variant.processingError = error.message
      await this.variantRepository.save(variant)
      throw error
    }
  }

  private async generateAdaptiveStreaming(video: Video, variants: VideoVariant[]): Promise<void> {
    const mp4Variants = variants.filter((v) => v.format === VideoFormat.MP4 && v.status === VariantStatus.COMPLETED)

    if (mp4Variants.length === 0) {
      throw new Error("No MP4 variants available for adaptive streaming")
    }

    // Generate HLS manifest
    const hlsPath = await this.generateVariantPath(video.id, VideoQuality.HIGH, VideoFormat.HLS)
    await this.ffmpegService.generateHLS(
      mp4Variants.map((v) => v.filePath),
      hlsPath,
    )

    // Create HLS variant record
    const hlsVariant = this.variantRepository.create({
      videoId: video.id,
      quality: VideoQuality.HIGH,
      format: VideoFormat.HLS,
      status: VariantStatus.COMPLETED,
      filePath: hlsPath,
      processingCompletedAt: new Date(),
    })

    await this.variantRepository.save(hlsVariant)

    // Generate DASH manifest
    const dashPath = await this.generateVariantPath(video.id, VideoQuality.HIGH, VideoFormat.DASH)
    await this.ffmpegService.generateDASH(
      mp4Variants.map((v) => v.filePath),
      dashPath,
    )

    // Create DASH variant record
    const dashVariant = this.variantRepository.create({
      videoId: video.id,
      quality: VideoQuality.HIGH,
      format: VideoFormat.DASH,
      status: VariantStatus.COMPLETED,
      filePath: dashPath,
      processingCompletedAt: new Date(),
    })

    await this.variantRepository.save(dashVariant)
  }

  private getEncodingSettings(quality: VideoQuality, format: VideoFormat) {
    const settings = {
      [VideoQuality.ULTRA_LOW]: { width: 426, height: 240, bitrate: "400k", crf: 28 },
      [VideoQuality.LOW]: { width: 640, height: 360, bitrate: "800k", crf: 26 },
      [VideoQuality.MEDIUM]: { width: 854, height: 480, bitrate: "1200k", crf: 24 },
      [VideoQuality.HIGH]: { width: 1280, height: 720, bitrate: "2500k", crf: 22 },
      [VideoQuality.FULL_HD]: { width: 1920, height: 1080, bitrate: "4000k", crf: 20 },
      [VideoQuality.QUAD_HD]: { width: 2560, height: 1440, bitrate: "8000k", crf: 18 },
      [VideoQuality.ULTRA_HD]: { width: 3840, height: 2160, bitrate: "15000k", crf: 16 },
    }

    const formatSettings = {
      [VideoFormat.MP4]: { codec: "libx264", container: "mp4" },
      [VideoFormat.WEBM]: { codec: "libvpx-vp9", container: "webm" },
    }

    return {
      ...settings[quality],
      ...formatSettings[format],
    }
  }

  private async createProcessingJobs(video: Video, options: ProcessingOptions): Promise<VideoProcessingJob[]> {
    const jobs: VideoProcessingJob[] = []

    // Metadata extraction job
    jobs.push(
      this.jobRepository.create({
        videoId: video.id,
        type: JobType.METADATA_EXTRACTION,
        priority: JobPriority.HIGH,
        parameters: {},
      }),
    )

    // Thumbnail generation job
    if (options.generateThumbnails !== false) {
      jobs.push(
        this.jobRepository.create({
          videoId: video.id,
          type: JobType.THUMBNAIL_GENERATION,
          priority: JobPriority.NORMAL,
          parameters: { count: 5, timestamps: [10, 25, 50, 75, 90] },
        }),
      )
    }

    // Transcoding jobs for each quality/format combination
    const qualities = options.qualities || [VideoQuality.HIGH, VideoQuality.MEDIUM, VideoQuality.LOW]
    const formats = options.formats || [VideoFormat.MP4, VideoFormat.WEBM]

    for (const quality of qualities) {
      for (const format of formats) {
        jobs.push(
          this.jobRepository.create({
            videoId: video.id,
            type: JobType.TRANSCODE,
            priority: options.priority || JobPriority.NORMAL,
            parameters: { quality, format },
          }),
        )
      }
    }

    // Adaptive streaming job
    if (options.enableAdaptiveStreaming) {
      jobs.push(
        this.jobRepository.create({
          videoId: video.id,
          type: JobType.ADAPTIVE_STREAMING,
          priority: JobPriority.LOW,
          parameters: {},
        }),
      )
    }

    return await this.jobRepository.save(jobs)
  }

  private async queueJobs(jobs: VideoProcessingJob[]): Promise<void> {
    for (const job of jobs) {
      await this.queueService.addJob(job)
    }
  }

  private async updateVideoStatus(videoId: string, status: VideoStatus, error?: string): Promise<void> {
    const updateData: Partial<Video> = { status }
    if (error) {
      updateData.processingError = error
    }
    await this.videoRepository.update(videoId, updateData)
  }

  private async updateVideoMetadata(videoId: string, metadata: any): Promise<void> {
    await this.videoRepository.update(videoId, {
      duration: metadata.duration,
      width: metadata.width,
      height: metadata.height,
      frameRate: metadata.frameRate,
      codec: metadata.codec,
      bitrate: metadata.bitrate,
      metadata,
    })
  }

  private async updateVideoThumbnail(videoId: string, thumbnailPath: string): Promise<void> {
    await this.videoRepository.update(videoId, { thumbnailPath })
  }

  private async updateVariantProgress(variantId: string, progress: number): Promise<void> {
    await this.variantRepository.update(variantId, { processingProgress: progress })
  }

  private async generateVariantPath(videoId: string, quality: VideoQuality, format: VideoFormat): Promise<string> {
    return `processed/${videoId}/${quality}.${format}`
  }

  async getProcessingStatus(videoId: string) {
    const video = await this.videoRepository.findOne({
      where: { id: videoId },
      relations: ["variants", "processingJobs"],
    })

    if (!video) {
      throw new BadRequestException(`Video with ID ${videoId} not found`)
    }

    const totalJobs = video.processingJobs.length
    const completedJobs = video.processingJobs.filter((job) => job.status === JobStatus.COMPLETED).length
    const failedJobs = video.processingJobs.filter((job) => job.status === JobStatus.FAILED).length

    return {
      videoId: video.id,
      status: video.status,
      progress: video.processingProgress,
      totalJobs,
      completedJobs,
      failedJobs,
      variants: video.variants.map((variant) => ({
        id: variant.id,
        quality: variant.quality,
        format: variant.format,
        status: variant.status,
        progress: variant.processingProgress,
      })),
      jobs: video.processingJobs.map((job) => ({
        id: job.id,
        type: job.type,
        status: job.status,
        progress: job.progress,
        error: job.error,
      })),
    }
  }

  async cancelProcessing(videoId: string): Promise<void> {
    await this.videoRepository.update(videoId, { status: VideoStatus.FAILED })
    await this.jobRepository.update({ videoId, status: JobStatus.QUEUED }, { status: JobStatus.CANCELLED })
  }
}
