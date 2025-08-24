import { Injectable, Logger, BadRequestException } from "@nestjs/common"
import type { EventEmitter2 } from "@nestjs/event-emitter"
import * as ffmpeg from "fluent-ffmpeg"

export interface StreamConfig {
  roomId: string
  streamKey: string
  rtmpUrl: string
  resolution: "720p" | "1080p" | "480p"
  bitrate: number
  framerate: number
}

export interface StreamStats {
  isLive: boolean
  viewers: number
  duration: number
  bitrate: number
  resolution: string
  startTime?: Date
  endTime?: Date
}

@Injectable()
export class MediaStreamingService {
  private readonly logger = new Logger("MediaStreamingService")
  private activeStreams = new Map<string, StreamStats>()
  private streamProcesses = new Map<string, any>()

  constructor(private eventEmitter: EventEmitter2) {}

  async startStream(config: StreamConfig): Promise<{ success: boolean; message: string }> {
    try {
      if (this.activeStreams.has(config.roomId)) {
        throw new BadRequestException("Stream already active for this room")
      }

      // Initialize stream stats
      const streamStats: StreamStats = {
        isLive: true,
        viewers: 0,
        duration: 0,
        bitrate: config.bitrate,
        resolution: config.resolution,
        startTime: new Date(),
      }

      this.activeStreams.set(config.roomId, streamStats)

      // In a real implementation, you would start the RTMP stream
      // For demo purposes, we'll simulate the stream
      this.simulateStream(config)

      this.eventEmitter.emit("stream.started", {
        roomId: config.roomId,
        streamKey: config.streamKey,
        startTime: streamStats.startTime,
      })

      this.logger.log(`Stream started for room ${config.roomId}`)

      return {
        success: true,
        message: "Stream started successfully",
      }
    } catch (error) {
      this.logger.error(`Failed to start stream for room ${config.roomId}:`, error)
      throw error
    }
  }

  async stopStream(roomId: string): Promise<{ success: boolean; message: string }> {
    try {
      const streamStats = this.activeStreams.get(roomId)
      if (!streamStats) {
        throw new BadRequestException("No active stream found for this room")
      }

      // Stop the stream process
      const process = this.streamProcesses.get(roomId)
      if (process) {
        process.kill("SIGTERM")
        this.streamProcesses.delete(roomId)
      }

      // Update stream stats
      streamStats.isLive = false
      streamStats.endTime = new Date()
      streamStats.duration = Math.floor((streamStats.endTime.getTime() - streamStats.startTime.getTime()) / 1000)

      this.eventEmitter.emit("stream.stopped", {
        roomId,
        endTime: streamStats.endTime,
        duration: streamStats.duration,
      })

      this.activeStreams.delete(roomId)

      this.logger.log(`Stream stopped for room ${roomId}`)

      return {
        success: true,
        message: "Stream stopped successfully",
      }
    } catch (error) {
      this.logger.error(`Failed to stop stream for room ${roomId}:`, error)
      throw error
    }
  }

  private simulateStream(config: StreamConfig): void {
    // Simulate stream process
    const mockProcess = {
      kill: (signal: string) => {
        this.logger.log(`Mock stream process killed with signal ${signal}`)
      },
    }

    this.streamProcesses.set(config.roomId, mockProcess)

    // Simulate viewer count updates
    const updateInterval = setInterval(() => {
      const stats = this.activeStreams.get(config.roomId)
      if (stats && stats.isLive) {
        // Simulate viewer count changes
        stats.viewers = Math.max(0, stats.viewers + Math.floor(Math.random() * 5) - 2)
        stats.duration = Math.floor((Date.now() - stats.startTime.getTime()) / 1000)

        this.eventEmitter.emit("stream.stats.updated", {
          roomId: config.roomId,
          stats,
        })
      } else {
        clearInterval(updateInterval)
      }
    }, 5000)
  }

  async getStreamStats(roomId: string): Promise<StreamStats> {
    const stats = this.activeStreams.get(roomId)
    if (!stats) {
      throw new BadRequestException("No active stream found for this room")
    }

    return { ...stats }
  }

  async updateViewerCount(roomId: string, count: number): Promise<void> {
    const stats = this.activeStreams.get(roomId)
    if (stats) {
      stats.viewers = count
    }
  }

  async getAllActiveStreams(): Promise<Map<string, StreamStats>> {
    return new Map(this.activeStreams)
  }

  async processVideoForStreaming(
    inputPath: string,
    outputPath: string,
    options: {
      resolution?: string
      bitrate?: string
      framerate?: number
    } = {},
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath)

      if (options.resolution) {
        command = command.size(options.resolution)
      }

      if (options.bitrate) {
        command = command.videoBitrate(options.bitrate)
      }

      if (options.framerate) {
        command = command.fps(options.framerate)
      }

      command
        .format("mp4")
        .videoCodec("libx264")
        .audioCodec("aac")
        .on("end", () => {
          this.logger.log(`Video processing completed: ${outputPath}`)
          resolve()
        })
        .on("error", (error) => {
          this.logger.error(`Video processing failed: ${error.message}`)
          reject(error)
        })
        .save(outputPath)
    })
  }

  async generateThumbnail(videoPath: string, outputPath: string, timeOffset = "00:00:01"): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .seekInput(timeOffset)
        .frames(1)
        .size("320x240")
        .format("png")
        .on("end", () => {
          this.logger.log(`Thumbnail generated: ${outputPath}`)
          resolve()
        })
        .on("error", (error) => {
          this.logger.error(`Thumbnail generation failed: ${error.message}`)
          reject(error)
        })
        .save(outputPath)
    })
  }

  async getVideoMetadata(videoPath: string): Promise<{
    duration: number
    resolution: { width: number; height: number }
    bitrate: number
    framerate: number
    size: number
  }> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (error, metadata) => {
        if (error) {
          reject(error)
          return
        }

        const videoStream = metadata.streams.find((stream) => stream.codec_type === "video")
        if (!videoStream) {
          reject(new Error("No video stream found"))
          return
        }

        resolve({
          duration: metadata.format.duration || 0,
          resolution: {
            width: videoStream.width || 0,
            height: videoStream.height || 0,
          },
          bitrate: Number.parseInt(metadata.format.bit_rate) || 0,
          framerate: eval(videoStream.r_frame_rate) || 0,
          size: metadata.format.size || 0,
        })
      })
    })
  }
}
