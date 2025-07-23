import { Injectable, Logger, BadRequestException } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { ConfigService } from "@nestjs/config"
import { type Asset, AssetType, OptimizationStatus } from "../entities/asset.entity"
import { type CDNProvider, ProviderType, ProviderStatus } from "../entities/cdn-provider.entity"
import type { AssetOptimizationService } from "./asset-optimization.service"
import type { EdgeCachingService } from "./edge-caching.service"
import type { GeoLocationService } from "./geo-location.service"
import type { CDNResponse, OptimizationOptions } from "../interfaces/cdn.interfaces"
import * as crypto from "crypto"

@Injectable()
export class CDNService {
  private readonly logger = new Logger(CDNService.name)

  constructor(
    private readonly assetRepository: Repository<Asset>,
    private readonly providerRepository: Repository<CDNProvider>,
    private readonly configService: ConfigService,
    private readonly assetOptimizationService: AssetOptimizationService,
    private readonly edgeCachingService: EdgeCachingService,
    private readonly geoLocationService: GeoLocationService,
  ) {}

  async uploadAsset(
    file: Buffer,
    filename: string,
    type: AssetType,
    options?: OptimizationOptions,
  ): Promise<CDNResponse> {
    try {
      // Generate content hash
      const contentHash = crypto.createHash("sha256").update(file).digest("hex")

      // Check if asset already exists
      let asset = await this.assetRepository.findOne({
        where: { contentHash },
      })

      if (!asset) {
        // Create new asset record
        asset = this.assetRepository.create({
          originalUrl: filename,
          type,
          originalSize: file.length,
          contentHash,
          status: OptimizationStatus.PENDING,
        })
        asset = await this.assetRepository.save(asset)
      }

      // Optimize asset if needed
      let optimizedBuffer = file
      if (type === AssetType.IMAGE && options) {
        optimizedBuffer = await this.assetOptimizationService.optimizeImage(file, options)
        asset.optimizedSize = optimizedBuffer.length
        asset.status = OptimizationStatus.COMPLETED
      }

      // Upload to CDN providers
      const cdnUrls = await this.uploadToProviders(optimizedBuffer, filename, asset.id)
      asset.cdnUrls = cdnUrls
      await this.assetRepository.save(asset)

      // Cache the asset
      await this.edgeCachingService.cacheAsset(asset.id, cdnUrls[0])

      return {
        url: cdnUrls[0],
        provider: "primary",
        region: "global",
        cached: true,
        optimized: type === AssetType.IMAGE,
        size: optimizedBuffer.length,
        metadata: asset.metadata,
      }
    } catch (error) {
      this.logger.error(`Failed to upload asset: ${error.message}`, error.stack)
      throw new BadRequestException("Failed to upload asset")
    }
  }

  async getOptimizedUrl(assetId: string, userIp?: string, connectionType?: string): Promise<CDNResponse> {
    const asset = await this.assetRepository.findOne({
      where: { id: assetId },
    })

    if (!asset) {
      throw new BadRequestException("Asset not found")
    }

    // Get user location for geo-optimization
    let region = "global"
    if (userIp) {
      const geoData = await this.geoLocationService.getLocationByIP(userIp)
      region = geoData.region
    }

    // Get optimal CDN provider for region
    const provider = await this.getOptimalProvider(region)

    // Get cached URL or fallback to original
    const cachedUrl = await this.edgeCachingService.getCachedUrl(asset.id, region, provider.type)

    // Apply bandwidth optimization if needed
    let finalUrl = cachedUrl || asset.cdnUrls[0]
    if (connectionType && asset.type === AssetType.IMAGE) {
      finalUrl = await this.applyBandwidthOptimization(finalUrl, connectionType)
    }

    return {
      url: finalUrl,
      provider: provider.name,
      region,
      cached: !!cachedUrl,
      optimized: asset.status === OptimizationStatus.COMPLETED,
      size: asset.optimizedSize || asset.originalSize,
      metadata: asset.metadata,
    }
  }

  async purgeCache(assetId: string, regions?: string[]): Promise<void> {
    const asset = await this.assetRepository.findOne({
      where: { id: assetId },
    })

    if (!asset) {
      throw new BadRequestException("Asset not found")
    }

    // Purge from edge cache
    await this.edgeCachingService.purgeAsset(assetId, regions)

    // Purge from CDN providers
    const providers = await this.getActiveProviders()
    for (const provider of providers) {
      await this.purgeFromProvider(provider, asset.cdnUrls, regions)
    }

    this.logger.log(`Cache purged for asset ${assetId}`)
  }

  private async uploadToProviders(buffer: Buffer, filename: string, assetId: string): Promise<string[]> {
    const providers = await this.getActiveProviders()
    const urls: string[] = []

    for (const provider of providers) {
      try {
        const url = await this.uploadToProvider(provider, buffer, filename, assetId)
        urls.push(url)
      } catch (error) {
        this.logger.warn(`Failed to upload to provider ${provider.name}: ${error.message}`)
      }
    }

    if (urls.length === 0) {
      throw new Error("Failed to upload to any CDN provider")
    }

    return urls
  }

  private async uploadToProvider(
    provider: CDNProvider,
    buffer: Buffer,
    filename: string,
    assetId: string,
  ): Promise<string> {
    switch (provider.type) {
      case ProviderType.CLOUDFLARE:
        return this.uploadToCloudflare(provider, buffer, filename, assetId)
      case ProviderType.AWS_CLOUDFRONT:
        return this.uploadToCloudFront(provider, buffer, filename, assetId)
      default:
        throw new Error(`Unsupported provider type: ${provider.type}`)
    }
  }

  private async uploadToCloudflare(
    provider: CDNProvider,
    buffer: Buffer,
    filename: string,
    assetId: string,
  ): Promise<string> {
    // Implement Cloudflare upload logic
    const config = provider.config
    const key = `assets/${assetId}/${filename}`

    // This would use Cloudflare's API to upload the file
    // For now, return a mock URL
    return `https://cdn.cloudflare.com/${key}`
  }

  private async uploadToCloudFront(
    provider: CDNProvider,
    buffer: Buffer,
    filename: string,
    assetId: string,
  ): Promise<string> {
    // Implement AWS CloudFront upload logic
    const config = provider.config
    const key = `assets/${assetId}/${filename}`

    // This would use AWS SDK to upload to S3 and serve via CloudFront
    // For now, return a mock URL
    return `https://d123456789.cloudfront.net/${key}`
  }

  private async getActiveProviders(): Promise<CDNProvider[]> {
    return this.providerRepository.find({
      where: { status: ProviderStatus.ACTIVE },
      order: { priority: "ASC" },
    })
  }

  private async getOptimalProvider(region: string): Promise<CDNProvider> {
    const providers = await this.providerRepository.find({
      where: { status: ProviderStatus.ACTIVE },
      order: { priority: "ASC" },
    })

    // Find provider that serves the region
    const regionalProvider = providers.find((p) => p.regions.includes(region) || p.regions.includes("global"))

    return regionalProvider || providers[0]
  }

  private async applyBandwidthOptimization(url: string, connectionType: string): Promise<string> {
    // Apply different optimization based on connection type
    const qualityMap = {
      "slow-2g": 30,
      "2g": 50,
      "3g": 70,
      "4g": 85,
      "5g": 95,
      wifi: 95,
    }

    const quality = qualityMap[connectionType] || 85

    // Append quality parameter to URL
    const separator = url.includes("?") ? "&" : "?"
    return `${url}${separator}quality=${quality}&format=webp`
  }

  private async purgeFromProvider(provider: CDNProvider, urls: string[], regions?: string[]): Promise<void> {
    switch (provider.type) {
      case ProviderType.CLOUDFLARE:
        await this.purgeFromCloudflare(provider, urls, regions)
        break
      case ProviderType.AWS_CLOUDFRONT:
        await this.purgeFromCloudFront(provider, urls, regions)
        break
    }
  }

  private async purgeFromCloudflare(provider: CDNProvider, urls: string[], regions?: string[]): Promise<void> {
    // Implement Cloudflare cache purging
    this.logger.log(`Purging ${urls.length} URLs from Cloudflare`)
  }

  private async purgeFromCloudFront(provider: CDNProvider, urls: string[], regions?: string[]): Promise<void> {
    // Implement CloudFront cache invalidation
    this.logger.log(`Purging ${urls.length} URLs from CloudFront`)
  }
}
