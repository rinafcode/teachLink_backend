import { Injectable, Logger, type OnModuleInit } from "@nestjs/common"
import { Cron, CronExpression } from "@nestjs/schedule"
import type { CachingService } from "../caching.service"
import type { CacheAnalyticsService } from "../analytics/cache-analytics.service"

export interface WarmingStrategy {
  name: string
  priority: number
  schedule: string
  enabled: boolean
  keys: string[]
  dataLoader: (key: string) => Promise<any>
  condition?: () => boolean
}

export interface WarmingJob {
  id: string
  strategy: string
  status: "pending" | "running" | "completed" | "failed"
  startTime?: Date
  endTime?: Date
  keysWarmed: number
  errors: string[]
}

@Injectable()
export class CacheWarmingService implements OnModuleInit {
  private readonly logger = new Logger(CacheWarmingService.name)
  private warmingStrategies = new Map<string, WarmingStrategy>()
  private activeJobs = new Map<string, WarmingJob>()
  private warmingHistory: WarmingJob[] = []

  constructor(
    private readonly caching: CachingService,
    private readonly analytics: CacheAnalyticsService,
  ) {}

  async onModuleInit() {
    await this.initializeWarmingStrategies()
    this.logger.log("Cache warming service initialized")
  }

  private async initializeWarmingStrategies() {
    // Popular content warming strategy
    this.addWarmingStrategy({
      name: "popular-content",
      priority: 1,
      schedule: "0 */15 * * * *", // Every 15 minutes
      enabled: true,
      keys: [],
      dataLoader: async (key: string) => {
        // This would typically fetch from database
        return await this.loadPopularContent(key)
      },
      condition: () => this.shouldWarmPopularContent(),
    })

    // User session warming strategy
    this.addWarmingStrategy({
      name: "user-sessions",
      priority: 2,
      schedule: "0 */5 * * * *", // Every 5 minutes
      enabled: true,
      keys: [],
      dataLoader: async (key: string) => {
        return await this.loadUserSessionData(key)
      },
      condition: () => this.isBusinessHours(),
    })

    // Configuration warming strategy
    this.addWarmingStrategy({
      name: "configuration",
      priority: 3,
      schedule: "0 0 * * * *", // Every hour
      enabled: true,
      keys: ["config:app", "config:features", "config:limits"],
      dataLoader: async (key: string) => {
        return await this.loadConfigurationData(key)
      },
    })

    // Trending data warming strategy
    this.addWarmingStrategy({
      name: "trending-data",
      priority: 4,
      schedule: "0 */30 * * * *", // Every 30 minutes
      enabled: true,
      keys: [],
      dataLoader: async (key: string) => {
        return await this.loadTrendingData(key)
      },
      condition: () => this.shouldWarmTrendingData(),
    })

    this.logger.log(`Initialized ${this.warmingStrategies.size} warming strategies`)
  }

  addWarmingStrategy(strategy: WarmingStrategy): void {
    this.warmingStrategies.set(strategy.name, strategy)
    this.logger.debug(`Added warming strategy: ${strategy.name}`)
  }

  removeWarmingStrategy(name: string): void {
    this.warmingStrategies.delete(name)
    this.logger.debug(`Removed warming strategy: ${name}`)
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async executeScheduledWarming(): Promise<void> {
    const strategies = Array.from(this.warmingStrategies.values())
      .filter((s) => s.enabled)
      .sort((a, b) => a.priority - b.priority)

    for (const strategy of strategies) {
      if (this.shouldExecuteStrategy(strategy)) {
        await this.executeWarmingStrategy(strategy)
      }
    }
  }

  private shouldExecuteStrategy(strategy: WarmingStrategy): boolean {
    // Check if strategy condition is met
    if (strategy.condition && !strategy.condition()) {
      return false
    }

    // Check if strategy is already running
    const activeJob = Array.from(this.activeJobs.values()).find(
      (job) => job.strategy === strategy.name && job.status === "running",
    )

    return !activeJob
  }

  async executeWarmingStrategy(strategy: WarmingStrategy): Promise<WarmingJob> {
    const jobId = `${strategy.name}-${Date.now()}`
    const job: WarmingJob = {
      id: jobId,
      strategy: strategy.name,
      status: "pending",
      keysWarmed: 0,
      errors: [],
    }

    this.activeJobs.set(jobId, job)
    this.logger.log(`Starting cache warming job: ${jobId}`)

    try {
      job.status = "running"
      job.startTime = new Date()

      // Get keys to warm
      const keysToWarm = await this.getKeysToWarm(strategy)
      this.logger.debug(`Warming ${keysToWarm.length} keys for strategy ${strategy.name}`)

      // Warm cache in batches to avoid overwhelming the system
      const batchSize = 10
      for (let i = 0; i < keysToWarm.length; i += batchSize) {
        const batch = keysToWarm.slice(i, i + batchSize)
        await this.warmBatch(batch, strategy, job)
      }

      job.status = "completed"
      job.endTime = new Date()

      this.logger.log(`Cache warming completed: ${jobId} (${job.keysWarmed} keys warmed, ${job.errors.length} errors)`)
    } catch (error) {
      job.status = "failed"
      job.endTime = new Date()
      job.errors.push(error.message)
      this.logger.error(`Cache warming failed: ${jobId}`, error)
    } finally {
      this.activeJobs.delete(jobId)
      this.warmingHistory.push(job)

      // Keep only last 100 jobs in history
      if (this.warmingHistory.length > 100) {
        this.warmingHistory = this.warmingHistory.slice(-100)
      }
    }

    return job
  }

  private async getKeysToWarm(strategy: WarmingStrategy): Promise<string[]> {
    const keys = [...strategy.keys]

    // Add dynamic keys based on strategy
    switch (strategy.name) {
      case "popular-content":
        keys.push(...(await this.getPopularContentKeys()))
        break
      case "user-sessions":
        keys.push(...(await this.getActiveUserSessionKeys()))
        break
      case "trending-data":
        keys.push(...(await this.getTrendingDataKeys()))
        break
    }

    return keys
  }

  private async warmBatch(keys: string[], strategy: WarmingStrategy, job: WarmingJob): Promise<void> {
    await Promise.all(
      keys.map(async (key) => {
        try {
          // Check if key is already cached
          const exists = await this.caching.exists(key)
          if (!exists) {
            const data = await strategy.dataLoader(key)
            await this.caching.set(key, data, {
              ttl: this.calculateWarmingTTL(strategy, key),
              priority: "high",
              tags: [`warming:${strategy.name}`],
            })
            job.keysWarmed++
            this.analytics.recordCacheWarming(key, strategy.name)
          }
        } catch (error) {
          job.errors.push(`${key}: ${error.message}`)
          this.logger.error(`Error warming key ${key}`, error)
        }
      }),
    )
  }

  private calculateWarmingTTL(strategy: WarmingStrategy, key: string): number {
    // Calculate TTL based on strategy and key patterns
    const baseTTL = 3600 // 1 hour

    switch (strategy.name) {
      case "popular-content":
        return baseTTL * 2 // 2 hours for popular content
      case "user-sessions":
        return baseTTL / 2 // 30 minutes for user sessions
      case "configuration":
        return baseTTL * 24 // 24 hours for configuration
      case "trending-data":
        return baseTTL // 1 hour for trending data
      default:
        return baseTTL
    }
  }

  // Data loading methods (these would typically interact with your database)
  private async loadPopularContent(key: string): Promise<any> {
    // Simulate loading popular content from database
    this.logger.debug(`Loading popular content: ${key}`)
    return {
      id: key.split(":")[1],
      title: "Popular Content",
      views: Math.floor(Math.random() * 10000),
      loadedAt: new Date(),
    }
  }

  private async loadUserSessionData(key: string): Promise<any> {
    // Simulate loading user session data
    this.logger.debug(`Loading user session: ${key}`)
    return {
      userId: key.split(":")[1],
      sessionId: key.split(":")[2],
      preferences: {},
      lastActivity: new Date(),
    }
  }

  private async loadConfigurationData(key: string): Promise<any> {
    // Simulate loading configuration data
    this.logger.debug(`Loading configuration: ${key}`)
    const configs = {
      "config:app": { name: "MyApp", version: "1.0.0", features: [] },
      "config:features": { featureFlags: {}, experiments: {} },
      "config:limits": { rateLimit: 1000, maxUsers: 10000 },
    }
    return configs[key] || {}
  }

  private async loadTrendingData(key: string): Promise<any> {
    // Simulate loading trending data
    this.logger.debug(`Loading trending data: ${key}`)
    return {
      type: "trending",
      items: Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        score: Math.random() * 100,
      })),
      updatedAt: new Date(),
    }
  }

  // Key generation methods
  private async getPopularContentKeys(): Promise<string[]> {
    // This would typically query your analytics or database
    const popularIds = await this.analytics.getPopularContentIds(50)
    return popularIds.map((id) => `content:${id}`)
  }

  private async getActiveUserSessionKeys(): Promise<string[]> {
    // This would typically query active sessions
    const activeUsers = await this.analytics.getActiveUserIds(100)
    return activeUsers.flatMap((userId) => [
      `user:profile:${userId}`,
      `user:preferences:${userId}`,
      `user:permissions:${userId}`,
    ])
  }

  private async getTrendingDataKeys(): Promise<string[]> {
    return ["trending:posts", "trending:users", "trending:topics", "trending:hashtags", "trending:categories"]
  }

  // Condition methods
  private shouldWarmPopularContent(): boolean {
    // Warm popular content during business hours
    return this.isBusinessHours()
  }

  private shouldWarmTrendingData(): boolean {
    // Always warm trending data as it changes frequently
    return true
  }

  private isBusinessHours(): boolean {
    const now = new Date()
    const hour = now.getHours()
    return hour >= 8 && hour <= 22 // 8 AM to 10 PM
  }

  async warmSpecificKeys(keys: string[], dataLoader: (key: string) => Promise<any>): Promise<WarmingJob> {
    const strategy: WarmingStrategy = {
      name: "manual-warming",
      priority: 0,
      schedule: "",
      enabled: true,
      keys,
      dataLoader,
    }

    return await this.executeWarmingStrategy(strategy)
  }

  async getWarmingStatus(): Promise<any> {
    return {
      activeJobs: Array.from(this.activeJobs.values()),
      recentHistory: this.warmingHistory.slice(-10),
      strategies: Array.from(this.warmingStrategies.values()).map((s) => ({
        name: s.name,
        enabled: s.enabled,
        priority: s.priority,
        schedule: s.schedule,
      })),
    }
  }

  async enableStrategy(name: string): Promise<void> {
    const strategy = this.warmingStrategies.get(name)
    if (strategy) {
      strategy.enabled = true
      this.logger.log(`Enabled warming strategy: ${name}`)
    }
  }

  async disableStrategy(name: string): Promise<void> {
    const strategy = this.warmingStrategies.get(name)
    if (strategy) {
      strategy.enabled = false
      this.logger.log(`Disabled warming strategy: ${name}`)
    }
  }

  async updateStrategySchedule(name: string, schedule: string): Promise<void> {
    const strategy = this.warmingStrategies.get(name)
    if (strategy) {
      strategy.schedule = schedule
      this.logger.log(`Updated schedule for warming strategy ${name}: ${schedule}`)
    }
  }
}
