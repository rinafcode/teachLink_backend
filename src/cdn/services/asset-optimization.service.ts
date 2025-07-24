import { Injectable, Logger } from "@nestjs/common"
import type { OptimizationOptions } from "../interfaces/cdn.interfaces"
import * as sharp from "sharp"

@Injectable()
export class AssetOptimizationService {
  private readonly logger = new Logger(AssetOptimizationService.name)

  async optimizeImage(buffer: Buffer, options: OptimizationOptions): Promise<Buffer> {
    try {
      let pipeline = sharp(buffer)

      // Resize if dimensions provided
      if (options.width || options.height) {
        pipeline = pipeline.resize(options.width, options.height, {
          fit: "inside",
          withoutEnlargement: true,
        })
      }

      // Apply format conversion
      switch (options.format) {
        case "webp":
          pipeline = pipeline.webp({
            quality: options.quality || 80,
            lossless: options.lossless,
          })
          break
        case "jpeg":
          pipeline = pipeline.jpeg({
            quality: options.quality || 80,
            progressive: options.progressive,
          })
          break
        case "png":
          pipeline = pipeline.png({
            quality: options.quality || 80,
            progressive: options.progressive,
          })
          break
        case "avif":
          pipeline = pipeline.avif({
            quality: options.quality || 80,
            lossless: options.lossless,
          })
          break
      }

      const optimizedBuffer = await pipeline.toBuffer()

      this.logger.log(`Image optimized: ${buffer.length} -> ${optimizedBuffer.length} bytes`)

      return optimizedBuffer
    } catch (error) {
      this.logger.error(`Image optimization failed: ${error.message}`)
      return buffer // Return original if optimization fails
    }
  }

  async generateResponsiveImages(
    buffer: Buffer,
    breakpoints: number[] = [320, 640, 768, 1024, 1280, 1920],
  ): Promise<{ width: number; buffer: Buffer }[]> {
    const results = []

    for (const width of breakpoints) {
      try {
        const optimized = await this.optimizeImage(buffer, {
          width,
          format: "webp",
          quality: 80,
        })
        results.push({ width, buffer: optimized })
      } catch (error) {
        this.logger.warn(`Failed to generate ${width}px variant: ${error.message}`)
      }
    }

    return results
  }

  async optimizeVideo(
    buffer: Buffer,
    options: {
      quality?: "low" | "medium" | "high"
      format?: "mp4" | "webm"
      maxBitrate?: number
    },
  ): Promise<Buffer> {
    // Video optimization would require ffmpeg or similar
    // For now, return original buffer
    this.logger.log("Video optimization not implemented yet")
    return buffer
  }

  async compressDocument(buffer: Buffer, type: "pdf" | "doc" | "docx"): Promise<Buffer> {
    // Document compression logic
    this.logger.log(`Document compression for ${type} not implemented yet`)
    return buffer
  }

  getOptimalFormat(userAgent: string): string {
    // Detect browser capabilities and return optimal format
    if (userAgent.includes("Chrome") && !userAgent.includes("Edge")) {
      return "webp"
    }
    if (userAgent.includes("Firefox")) {
      return "webp"
    }
    if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
      return "jpeg"
    }
    return "jpeg" // Fallback
  }

  calculateOptimizationSavings(
    originalSize: number,
    optimizedSize: number,
  ): {
    savedBytes: number
    savedPercentage: number
  } {
    const savedBytes = originalSize - optimizedSize
    const savedPercentage = (savedBytes / originalSize) * 100

    return {
      savedBytes,
      savedPercentage: Math.round(savedPercentage * 100) / 100,
    }
  }
}
