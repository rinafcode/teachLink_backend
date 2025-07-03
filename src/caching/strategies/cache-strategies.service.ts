import { Injectable, Logger } from "@nestjs/common"
import * as zlib from "zlib"
import { promisify } from "util"
import type { CacheOptions } from "../caching.service"

const gzip = promisify(zlib.gzip)
const gunzip = promisify(zlib.gunzip)

export interface CacheStrategy {
  name: string
  shouldCache: (key: string, value: any, options: CacheOptions) => boolean
  processValue: (key: string, value: any, options: CacheOptions) => Promise<any>
  calculateTTL: (key: string, value: any, options: CacheOptions) => number
}

@Injectable()
export class CacheStrategiesService {
  private readonly logger = new Logger(CacheStrategiesService.name)
  private strategies = new Map<string, CacheStrategy>()

  constructor() {
    this.initializeStrategies()
  }

  private initializeStrategies() {
    // LRU Strategy - Least Recently Used
    this.strategies.set("lru", {
      name: "LRU",
      shouldCache: (key, value, options) => {
        return value !== null && value !== undefined
      },
      processValue: async (key, value, options) => {
        if (options.compress && this.shouldCompress(value)) {
          return await this.compressValue(value)
        }
        return options.serialize ? JSON.stringify(value) : value
      },
      calculateTTL: (key, value, options) => {
        const baseTTL = options.ttl || 300
        const priority = options.priority || "medium"
        const multiplier = this.getPriorityMultiplier(priority)
        return Math.floor(baseTTL * multiplier)
      },
    })

    // LFU Strategy - Least Frequently Used
    this.strategies.set("lfu", {
      name: "LFU",
      shouldCache: (key, value, options) => {
        // Cache based on expected frequency
        return this.isHighFrequencyData(key, value)
      },
      processValue: async (key, value, options) => {
        // Add metadata for frequency tracking
        const processedValue = {
          data: value,
          frequency: 1,
          lastAccessed: new Date(),
        }
        return options.compress ? await this.compressValue(processedValue) : processedValue
      },
      calculateTTL: (key, value, options) => {
        const baseTTL = options.ttl || 600 // Longer TTL for LFU
        return this.isHighFrequencyData(key, value) ? baseTTL * 2 : baseTTL
      },
    })

    // FIFO Strategy - First In, First Out
    this.strategies.set("fifo", {
      name: "FIFO",
      shouldCache: (key, value, options) => {
        return true // Cache everything in FIFO order
      },
      processValue: async (key, value, options) => {
        const processedValue = {
          data: value,
          insertedAt: new Date(),
          order: Date.now(),
        }
        return options.compress ? await this.compressValue(processedValue) : processedValue
      },
      calculateTTL: (key, value, options) => {
        return options.ttl || 300
      },
    })

    // TTL Strategy - Time To Live based
    this.strategies.set("ttl", {
      name: "TTL",
      shouldCache: (key, value, options) => {
        return options.ttl !== undefined && options.ttl > 0
      },
      processValue: async (key, value, options) => {
        const processedValue = {
          data: value,
          expiresAt: new Date(Date.now() + (options.ttl || 300) * 1000),
        }
        return options.compress ? await this.compressValue(processedValue) : processedValue
      },
      calculateTTL: (key, value, options) => {
        return options.ttl || 300
      },
    })

    this.logger.log(`Initialized ${this.strategies.size} cache strategies`)
  }

  async applyStrategy(key: string, value: any, strategyName: string, options: CacheOptions): Promise<any> {
    const strategy = this.strategies.get(strategyName)
    if (!strategy) {
      this.logger.warn(`Unknown cache strategy: ${strategyName}, using default`)
      return value
    }

    if (!strategy.shouldCache(key, value, options)) {
      throw new Error(`Strategy ${strategyName} determined value should not be cached`)
    }

    try {
      const processedValue = await strategy.processValue(key, value, options)
      const ttl = strategy.calculateTTL(key, value, options)

      this.logger.debug(`Applied ${strategyName} strategy to ${key} (TTL: ${ttl}s)`)

      return {
        originalValue: processedValue,
        strategy: strategyName,
        ttl,
        processedAt: new Date(),
      }
    } catch (error) {
      this.logger.error(`Error applying strategy ${strategyName} to ${key}`, error)
      return value
    }
  }

  private shouldCompress(value: any): boolean {
    try {
      const size = JSON.stringify(value).length
      return size > 1024 // Compress if larger than 1KB
    } catch {
      return false
    }
  }

  private async compressValue(value: any): Promise<string> {
    try {
      const jsonString = JSON.stringify(value)
      const compressed = await gzip(jsonString)
      return compressed.toString("base64")
    } catch (error) {
      this.logger.error("Compression error", error)
      return value
    }
  }

  async decompressValue(compressedValue: string): Promise<any> {
    try {
      const buffer = Buffer.from(compressedValue, "base64")
      const decompressed = await gunzip(buffer)
      return JSON.parse(decompressed.toString())
    } catch (error) {
      this.logger.error("Decompression error", error)
      return compressedValue
    }
  }

  private isHighFrequencyData(key: string, value: any): boolean {
    // Determine if data is likely to be accessed frequently
    const highFrequencyPatterns = [/^user:profile:/, /^config:/, /^popular:/, /^trending:/, /^featured:/]

    return highFrequencyPatterns.some((pattern) => pattern.test(key))
  }

  private getPriorityMultiplier(priority: string): number {
    switch (priority) {
      case "critical":
        return 3.0
      case "high":
        return 2.0
      case "medium":
        return 1.0
      case "low":
        return 0.5
      default:
        return 1.0
    }
  }

  getAvailableStrategies(): string[] {
    return Array.from(this.strategies.keys())
  }

  getStrategyInfo(strategyName: string): CacheStrategy | undefined {
    return this.strategies.get(strategyName)
  }

  async optimizeStrategy(key: string, accessPattern: any): Promise<string> {
    // Analyze access patterns and recommend optimal strategy
    const { frequency, recency, size, importance } = accessPattern

    if (importance === "critical" || frequency > 100) {
      return "lfu" // High frequency data
    }

    if (recency < 3600 && frequency > 10) {
      return "lru" // Recently accessed data
    }

    if (size > 10000) {
      return "ttl" // Large data with specific TTL
    }

    return "fifo" // Default strategy
  }

  async analyzePerformance(): Promise<any> {
    const performance = {
      strategies: {},
      recommendations: [],
    }

    for (const [name, strategy] of this.strategies.entries()) {
      performance.strategies[name] = {
        name: strategy.name,
        usage: 0, // Would be tracked in real implementation
        avgHitRatio: 0, // Would be calculated from analytics
        avgResponseTime: 0, // Would be tracked
      }
    }

    // Generate recommendations based on performance data
    performance.recommendations = [
      "Consider using LFU strategy for user profile data",
      "TTL strategy recommended for time-sensitive data",
      "Enable compression for large objects to save memory",
    ]

    return performance
  }
}
