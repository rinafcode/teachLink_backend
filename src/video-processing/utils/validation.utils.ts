import { BadRequestException } from "@nestjs/common"
import { VideoQuality, VideoFormat } from "../entities/video-variant.entity"
import { JobPriority } from "../entities/video-processing-job.entity"
import type { Express } from "express"

export class ValidationUtils {
  static validateVideoFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException("No file provided")
    }

    if (!file.mimetype.startsWith("video/")) {
      throw new BadRequestException("File must be a video")
    }

    const maxSize = 5 * 1024 * 1024 * 1024 // 5GB
    if (file.size > maxSize) {
      throw new BadRequestException(`File size exceeds maximum limit of ${this.formatBytes(maxSize)}`)
    }

    const allowedExtensions = [".mp4", ".webm", ".avi", ".mov", ".mkv", ".flv", ".wmv", ".m4v"]
    const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf("."))

    if (!allowedExtensions.includes(fileExtension)) {
      throw new BadRequestException(`File type ${fileExtension} is not supported`)
    }
  }

  static validateProcessingOptions(options: {
    qualities?: VideoQuality[]
    formats?: VideoFormat[]
    priority?: JobPriority
  }): void {
    if (options.qualities) {
      const validQualities = Object.values(VideoQuality)
      for (const quality of options.qualities) {
        if (!validQualities.includes(quality)) {
          throw new BadRequestException(`Invalid quality: ${quality}`)
        }
      }
    }

    if (options.formats) {
      const validFormats = Object.values(VideoFormat)
      for (const format of options.formats) {
        if (!validFormats.includes(format)) {
          throw new BadRequestException(`Invalid format: ${format}`)
        }
      }
    }

    if (options.priority) {
      const validPriorities = Object.values(JobPriority)
      if (!validPriorities.includes(options.priority)) {
        throw new BadRequestException(`Invalid priority: ${options.priority}`)
      }
    }
  }

  static validateUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(uuid)
  }

  static validatePagination(page: number, limit: number): void {
    if (page < 1) {
      throw new BadRequestException("Page must be greater than 0")
    }

    if (limit < 1 || limit > 100) {
      throw new BadRequestException("Limit must be between 1 and 100")
    }
  }

  static validateDateRange(startDate?: string, endDate?: string): void {
    if (startDate && !this.isValidDate(startDate)) {
      throw new BadRequestException("Invalid start date format")
    }

    if (endDate && !this.isValidDate(endDate)) {
      throw new BadRequestException("Invalid end date format")
    }

    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)

      if (start >= end) {
        throw new BadRequestException("Start date must be before end date")
      }
    }
  }

  private static isValidDate(dateString: string): boolean {
    const date = new Date(dateString)
    return date instanceof Date && !isNaN(date.getTime())
  }

  private static formatBytes(bytes: number): string {
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
    if (bytes === 0) return "0 Bytes"
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${Math.round((bytes / Math.pow(1024, i)) * 100) / 100} ${sizes[i]}`
  }

  static sanitizeFilename(filename: string): string {
    // Remove or replace dangerous characters
    return filename
      .replace(/[<>:"/\\|?*]/g, "_") // Replace dangerous characters with underscore
      .replace(/\s+/g, "_") // Replace spaces with underscore
      .replace(/_{2,}/g, "_") // Replace multiple underscores with single
      .replace(/^_+|_+$/g, "") // Remove leading/trailing underscores
      .toLowerCase()
  }

  static validateEnvironmentVariables(): void {
    const required = ["DB_HOST", "DB_USERNAME", "DB_PASSWORD", "DB_NAME"]
    const missing = required.filter((key) => !process.env[key])

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(", ")}`)
    }
  }
}
