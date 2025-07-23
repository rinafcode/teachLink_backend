import { Injectable, Logger } from "@nestjs/common"
import { type Repository, LessThan } from "typeorm"
import { Cron, CronExpression } from "@nestjs/schedule"
import { type CacheEntry, CacheStatus } from "../entities/cache-entry.entity"
import type { CacheOptions } from "../interfaces/cdn.interfaces"

@Injectable()
export class EdgeCachingService {
  private readonly logger = new Logger(EdgeCachingService.name)
  private readonly defaultTTL = 86400 // 24 hours in seconds

  constructor(private readonly cacheRepository: Repository<CacheEntry>) {}

  async cacheAsset(assetId: string, url: string, options?: CacheOptions): Promise<void> {
    const ttl = options?.ttl || this.defaultTTL
    const region = options?.region || "global"
    const provider = options?.provider || "primary"

    const cacheKey = this.generateCacheKey(assetId, region, provider)
    const expiresAt = new Date(Date.now() + ttl * 1000)

    // Check if cache entry already exists
    let cacheEntry = await this.cacheRepository.findOne({
      where: { key: cacheKey },
    })

    if (cacheEntry) {
      // Update existing entry
      cacheEntry.url = url
      cacheEntry.expiresAt = expiresAt
      cacheEntry.status = CacheStatus.ACTIVE
    } else {
      // Create new cache entry
      cacheEntry = this.cacheRepository.create({
        key: cacheKey,
        url,
        region,
        provider,
        expiresAt,
        status: CacheStatus.ACTIVE,
      })
    }

    await this.cacheRepository.save(cacheEntry)
    this.logger.log(`Asset ${assetId} cached in region ${region}`)
  }

  async getCachedUrl(assetId: string, region = "global", provider = "primary"): Promise<string | null> {
    const cacheKey = this.generateCacheKey(assetId, region, provider)

    const cacheEntry = await this.cacheRepository.findOne({
      where: {
        key: cacheKey,
        status: CacheStatus.ACTIVE,
      },
    })

    if (!cacheEntry) {
      return null
    }

    // Check if cache is expired
    if (cacheEntry.expiresAt < new Date()) {
      await this.expireCache(cacheEntry.id)
      return null
    }

    // Update hit count and bandwidth
    await this.updateCacheStats(cacheEntry.id)

    return cacheEntry.url
  }

  async purgeAsset(assetId: string, regions?: string[]): Promise<void> {
    const whereCondition: any = {
      key: regions ? regions.map((region) => this.generateCacheKey(assetId, region, "%")) : `%${assetId}%`,
    }

    if (regions) {
      whereCondition.region = regions
    }

    await this.cacheRepository.update(whereCondition, { status: CacheStatus.PURGED })

    this.logger.log(`Cache purged for asset ${assetId}`)
  }

  async purgeByTags(tags: string[]): Promise<void> {
    // This would require a tags column in the cache entry
    // For now, implement basic tag-based purging logic
    this.logger.log(`Purging cache by tags: ${tags.join(", ")}`)
  }

  async warmCache(assetId: string, url: string, regions: string[]): Promise<void> {
    const promises = regions.map((region) => this.cacheAsset(assetId, url, { region }))

    await Promise.all(promises)
    this.logger.log(`Cache warmed for asset ${assetId} in ${regions.length} regions`)
  }

  async getCacheStats(region?: string): Promise<{
    totalEntries: number
    activeEntries: number
    expiredEntries: number
    totalHits: number
    totalBandwidth: number
  }> {
    const whereCondition = region ? { region } : {}

    const [totalEntries, activeEntries, expiredEntries] = await Promise.all([
      this.cacheRepository.count({ where: whereCondition }),
      this.cacheRepository.count({
        where: { ...whereCondition, status: CacheStatus.ACTIVE },
      }),
      this.cacheRepository.count({
        where: { ...whereCondition, status: CacheStatus.EXPIRED },
      }),
    ])

    const stats = await this.cacheRepository
      .createQueryBuilder("cache")
      .select("SUM(cache.hitCount)", "totalHits")
      .addSelect("SUM(cache.bandwidth)", "totalBandwidth")
      .where(region ? "cache.region = :region" : "1=1", { region })
      .getRawOne()

    return {
      totalEntries,
      activeEntries,
      expiredEntries,
      totalHits: Number.parseInt(stats.totalHits) || 0,
      totalBandwidth: Number.parseInt(stats.totalBandwidth) || 0,
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredCache(): Promise<void> {
    const expiredEntries = await this.cacheRepository.find({
      where: {
        expiresAt: LessThan(new Date()),
        status: CacheStatus.ACTIVE,
      },
    })

    if (expiredEntries.length > 0) {
      await this.cacheRepository.update({ expiresAt: LessThan(new Date()) }, { status: CacheStatus.EXPIRED })

      this.logger.log(`Cleaned up ${expiredEntries.length} expired cache entries`)
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async deleteOldCacheEntries(): Promise<void> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const result = await this.cacheRepository.delete({
      status: CacheStatus.EXPIRED,
      updatedAt: LessThan(thirtyDaysAgo),
    })

    this.logger.log(`Deleted ${result.affected} old cache entries`)
  }

  private generateCacheKey(assetId: string, region: string, provider: string): string {
    return `${assetId}:${region}:${provider}`
  }

  private async expireCache(cacheId: string): Promise<void> {
    await this.cacheRepository.update(cacheId, {
      status: CacheStatus.EXPIRED,
    })
  }

  private async updateCacheStats(cacheId: string): Promise<void> {
    await this.cacheRepository.increment({ id: cacheId }, "hitCount", 1)
    // Bandwidth would be updated based on actual request size
  }
}
