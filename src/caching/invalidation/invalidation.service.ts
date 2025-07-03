import { Injectable, Logger, type OnModuleInit } from "@nestjs/common"
import { type EventEmitter2, OnEvent } from "@nestjs/event-emitter"
import type { CachingService } from "../caching.service"
import type { CacheAnalyticsService } from "../analytics/cache-analytics.service"

export interface InvalidationRule {
  id: string
  name: string
  pattern: string
  tags: string[]
  events: string[]
  condition?: (data: any) => boolean
  delay?: number // Delay in milliseconds before invalidation
  cascade?: boolean // Whether to invalidate related keys
  enabled: boolean
  priority: number
}

export interface InvalidationEvent {
  id: string
  rule: string
  keys: string[]
  reason: string
  timestamp: Date
  success: boolean
  error?: string
}

@Injectable()
export class InvalidationService implements OnModuleInit {
  private readonly logger = new Logger(InvalidationService.name)
  private invalidationRules = new Map<string, InvalidationRule>()
  private invalidationHistory: InvalidationEvent[] = []
  private pendingInvalidations = new Map<string, NodeJS.Timeout>()

  constructor(
    private readonly caching: CachingService,
    private readonly analytics: CacheAnalyticsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    await this.initializeInvalidationRules()
    this.logger.log("Cache invalidation service initialized")
  }

  private async initializeInvalidationRules() {
    // User data invalidation rules
    this.addInvalidationRule({
      id: "user-profile-update",
      name: "User Profile Update",
      pattern: "user:profile:*",
      tags: ["user", "profile"],
      events: ["user.updated", "user.profile.changed"],
      cascade: true,
      enabled: true,
      priority: 1,
    })

    // Content invalidation rules
    this.addInvalidationRule({
      id: "content-update",
      name: "Content Update",
      pattern: "content:*",
      tags: ["content", "posts"],
      events: ["content.created", "content.updated", "content.deleted"],
      delay: 1000, // 1 second delay to batch updates
      cascade: true,
      enabled: true,
      priority: 2,
    })

    // Configuration invalidation rules
    this.addInvalidationRule({
      id: "config-update",
      name: "Configuration Update",
      pattern: "config:*",
      tags: ["config", "settings"],
      events: ["config.updated", "settings.changed"],
      enabled: true,
      priority: 1,
    })

    // Popular content invalidation (time-based)
    this.addInvalidationRule({
      id: "popular-content-refresh",
      name: "Popular Content Refresh",
      pattern: "popular:*",
      tags: ["popular", "trending"],
      events: ["analytics.updated", "popularity.changed"],
      delay: 5000, // 5 second delay to batch popularity updates
      enabled: true,
      priority: 3,
    })

    // Session invalidation rules
    this.addInvalidationRule({
      id: "session-invalidation",
      name: "Session Invalidation",
      pattern: "session:*",
      tags: ["session", "auth"],
      events: ["user.logout", "session.expired", "auth.revoked"],
      enabled: true,
      priority: 1,
    })

    // Search results invalidation
    this.addInvalidationRule({
      id: "search-invalidation",
      name: "Search Results Invalidation",
      pattern: "search:*",
      tags: ["search", "results"],
      events: ["content.indexed", "search.updated"],
      delay: 2000, // 2 second delay
      cascade: false,
      enabled: true,
      priority: 4,
    })

    this.logger.log(`Initialized ${this.invalidationRules.size} invalidation rules`)
  }

  addInvalidationRule(rule: InvalidationRule): void {
    this.invalidationRules.set(rule.id, rule)
    this.logger.debug(`Added invalidation rule: ${rule.name}`)
  }

  removeInvalidationRule(id: string): void {
    this.invalidationRules.delete(id)
    this.logger.debug(`Removed invalidation rule: ${id}`)
  }

  @OnEvent("**")
  async handleEvent(eventName: string, data: any): Promise<void> {
    const matchingRules = Array.from(this.invalidationRules.values())
      .filter((rule) => rule.enabled && rule.events.includes(eventName))
      .sort((a, b) => a.priority - b.priority)

    for (const rule of matchingRules) {
      if (!rule.condition || rule.condition(data)) {
        await this.scheduleInvalidation(rule, eventName, data)
      }
    }
  }

  private async scheduleInvalidation(rule: InvalidationRule, eventName: string, data: any): Promise<void> {
    const invalidationId = `${rule.id}-${Date.now()}`

    if (rule.delay && rule.delay > 0) {
      // Cancel any pending invalidation for the same rule
      const existingTimeout = this.pendingInvalidations.get(rule.id)
      if (existingTimeout) {
        clearTimeout(existingTimeout)
      }

      // Schedule delayed invalidation
      const timeout = setTimeout(async () => {
        await this.executeInvalidation(rule, eventName, data, invalidationId)
        this.pendingInvalidations.delete(rule.id)
      }, rule.delay)

      this.pendingInvalidations.set(rule.id, timeout)
      this.logger.debug(`Scheduled delayed invalidation for rule ${rule.name} (${rule.delay}ms delay)`)
    } else {
      // Execute immediately
      await this.executeInvalidation(rule, eventName, data, invalidationId)
    }
  }

  private async executeInvalidation(
    rule: InvalidationRule,
    eventName: string,
    data: any,
    invalidationId: string,
  ): Promise<void> {
    const event: InvalidationEvent = {
      id: invalidationId,
      rule: rule.id,
      keys: [],
      reason: `Event: ${eventName}`,
      timestamp: new Date(),
      success: false,
    }

    try {
      this.logger.debug(`Executing invalidation rule: ${rule.name}`)

      // Get keys to invalidate
      const keysToInvalidate = await this.getKeysToInvalidate(rule, data)
      event.keys = keysToInvalidate

      if (keysToInvalidate.length === 0) {
        this.logger.debug(`No keys to invalidate for rule: ${rule.name}`)
        event.success = true
        return
      }

      // Invalidate by pattern
      if (rule.pattern) {
        await this.caching.deleteByPattern(rule.pattern)
      }

      // Invalidate by tags
      if (rule.tags.length > 0) {
        await this.caching.deleteByTags(rule.tags)
      }

      // Invalidate specific keys
      await Promise.all(keysToInvalidate.map((key) => this.caching.delete(key)))

      // Cascade invalidation if enabled
      if (rule.cascade) {
        await this.cascadeInvalidation(keysToInvalidate, rule)
      }

      event.success = true
      this.analytics.recordCacheInvalidation(rule.id, keysToInvalidate.length, eventName)

      this.logger.log(`Cache invalidation completed: ${rule.name} (${keysToInvalidate.length} keys invalidated)`)
    } catch (error) {
      event.success = false
      event.error = error.message
      this.logger.error(`Cache invalidation failed: ${rule.name}`, error)
    } finally {
      this.invalidationHistory.push(event)

      // Keep only last 1000 events in history
      if (this.invalidationHistory.length > 1000) {
        this.invalidationHistory = this.invalidationHistory.slice(-1000)
      }
    }
  }

  private async getKeysToInvalidate(rule: InvalidationRule, data: any): Promise<string[]> {
    const keys: string[] = []

    // Extract keys from event data
    if (data && typeof data === "object") {
      // User-related invalidations
      if (data.userId) {
        keys.push(`user:profile:${data.userId}`, `user:preferences:${data.userId}`, `user:permissions:${data.userId}`)
      }

      // Content-related invalidations
      if (data.contentId) {
        keys.push(`content:${data.contentId}`, `content:details:${data.contentId}`)
      }

      // Category-related invalidations
      if (data.categoryId) {
        keys.push(`category:${data.categoryId}`, `category:content:${data.categoryId}`)
      }

      // Search-related invalidations
      if (data.searchTerm) {
        keys.push(`search:${data.searchTerm}`)
      }
    }

    return keys
  }

  private async cascadeInvalidation(keys: string[], rule: InvalidationRule): Promise<void> {
    const cascadeKeys: string[] = []

    for (const key of keys) {
      // Generate related keys based on patterns
      if (key.startsWith("user:profile:")) {
        const userId = key.split(":")[2]
        cascadeKeys.push(
          `user:posts:${userId}`,
          `user:followers:${userId}`,
          `user:following:${userId}`,
          `user:activity:${userId}`,
        )
      } else if (key.startsWith("content:")) {
        const contentId = key.split(":")[1]
        cascadeKeys.push(
          `content:comments:${contentId}`,
          `content:likes:${contentId}`,
          `content:shares:${contentId}`,
          `popular:content`, // Invalidate popular content list
          `trending:content`, // Invalidate trending content
        )
      } else if (key.startsWith("category:")) {
        cascadeKeys.push("popular:categories", "trending:categories")
      }
    }

    if (cascadeKeys.length > 0) {
      await Promise.all(cascadeKeys.map((key) => this.caching.delete(key)))
      this.logger.debug(`Cascade invalidation: ${cascadeKeys.length} additional keys invalidated`)
    }
  }

  async invalidateByPattern(pattern: string, reason = "Manual invalidation"): Promise<InvalidationEvent> {
    const event: InvalidationEvent = {
      id: `manual-${Date.now()}`,
      rule: "manual",
      keys: [],
      reason,
      timestamp: new Date(),
      success: false,
    }

    try {
      await this.caching.deleteByPattern(pattern)
      event.success = true
      this.logger.log(`Manual cache invalidation by pattern: ${pattern}`)
    } catch (error) {
      event.error = error.message
      this.logger.error(`Manual cache invalidation failed: ${pattern}`, error)
    }

    this.invalidationHistory.push(event)
    return event
  }

  async invalidateByTags(tags: string[], reason = "Manual invalidation"): Promise<InvalidationEvent> {
    const event: InvalidationEvent = {
      id: `manual-${Date.now()}`,
      rule: "manual",
      keys: [],
      reason,
      timestamp: new Date(),
      success: false,
    }

    try {
      await this.caching.deleteByTags(tags)
      event.success = true
      this.logger.log(`Manual cache invalidation by tags: ${tags.join(", ")}`)
    } catch (error) {
      event.error = error.message
      this.logger.error(`Manual cache invalidation failed: ${tags.join(", ")}`, error)
    }

    this.invalidationHistory.push(event)
    return event
  }

  async invalidateKeys(keys: string[], reason = "Manual invalidation"): Promise<InvalidationEvent> {
    const event: InvalidationEvent = {
      id: `manual-${Date.now()}`,
      rule: "manual",
      keys,
      reason,
      timestamp: new Date(),
      success: false,
    }

    try {
      await Promise.all(keys.map((key) => this.caching.delete(key)))
      event.success = true
      this.logger.log(`Manual cache invalidation: ${keys.length} keys invalidated`)
    } catch (error) {
      event.error = error.message
      this.logger.error(`Manual cache invalidation failed`, error)
    }

    this.invalidationHistory.push(event)
    return event
  }

  async getInvalidationHistory(limit = 100): Promise<InvalidationEvent[]> {
    return this.invalidationHistory.slice(-limit)
  }

  async getInvalidationRules(): Promise<InvalidationRule[]> {
    return Array.from(this.invalidationRules.values())
  }

  async enableRule(id: string): Promise<void> {
    const rule = this.invalidationRules.get(id)
    if (rule) {
      rule.enabled = true
      this.logger.log(`Enabled invalidation rule: ${rule.name}`)
    }
  }

  async disableRule(id: string): Promise<void> {
    const rule = this.invalidationRules.get(id)
    if (rule) {
      rule.enabled = false
      this.logger.log(`Disabled invalidation rule: ${rule.name}`)
    }
  }

  async updateRule(id: string, updates: Partial<InvalidationRule>): Promise<void> {
    const rule = this.invalidationRules.get(id)
    if (rule) {
      Object.assign(rule, updates)
      this.logger.log(`Updated invalidation rule: ${rule.name}`)
    }
  }

  async getInvalidationStats(): Promise<any> {
    const now = new Date()
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const recent24h = this.invalidationHistory.filter((e) => e.timestamp >= last24Hours)
    const recent7d = this.invalidationHistory.filter((e) => e.timestamp >= last7Days)

    return {
      total: this.invalidationHistory.length,
      successful: this.invalidationHistory.filter((e) => e.success).length,
      failed: this.invalidationHistory.filter((e) => !e.success).length,
      last24Hours: recent24h.length,
      last7Days: recent7d.length,
      byRule: this.getStatsByRule(),
      pendingInvalidations: this.pendingInvalidations.size,
      activeRules: Array.from(this.invalidationRules.values()).filter((r) => r.enabled).length,
    }
  }

  private getStatsByRule(): any {
    const stats = {}
    for (const event of this.invalidationHistory) {
      if (!stats[event.rule]) {
        stats[event.rule] = { total: 0, successful: 0, failed: 0 }
      }
      stats[event.rule].total++
      if (event.success) {
        stats[event.rule].successful++
      } else {
        stats[event.rule].failed++
      }
    }
    return stats
  }
}
