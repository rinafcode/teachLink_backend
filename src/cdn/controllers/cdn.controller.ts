import { Controller, Post, Get, Delete, Param, Query, UseInterceptors, BadRequestException } from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import type { Request } from "express"
import type { CDNService } from "../services/cdn.service"
import type { AssetOptimizationService } from "../services/asset-optimization.service"
import type { EdgeCachingService } from "../services/edge-caching.service"
import type { GeoLocationService } from "../services/geo-location.service"
import type { AssetType } from "../entities/asset.entity"
import type { OptimizationOptions } from "../interfaces/cdn.interfaces"
import type { Express } from "express"

@Controller("cdn")
export class CDNController {
  constructor(
    private readonly cdnService: CDNService,
    private readonly assetOptimizationService: AssetOptimizationService,
    private readonly edgeCachingService: EdgeCachingService,
    private readonly geoLocationService: GeoLocationService,
  ) {}

  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  async uploadAsset(
    file: Express.Multer.File,
    @Query('type') type: AssetType,
    @Query('quality') quality?: number,
    @Query('format') format?: string,
    @Query('width') width?: number,
    @Query('height') height?: number,
  ) {
    if (!file) {
      throw new BadRequestException("No file provided")
    }

    const options: OptimizationOptions = {
      quality: quality ? Number.parseInt(quality.toString()) : undefined,
      format: format as any,
      width: width ? Number.parseInt(width.toString()) : undefined,
      height: height ? Number.parseInt(height.toString()) : undefined,
    }

    return this.cdnService.uploadAsset(file.buffer, file.originalname, type, options)
  }

  @Get("asset/:id")
  async getAsset(@Param('id') assetId: string, @Query('connection') connectionType?: string, request?: Request) {
    const userIp = request?.ip || request?.connection?.remoteAddress

    return this.cdnService.getOptimizedUrl(assetId, userIp, connectionType)
  }

  @Delete("cache/:id")
  async purgeCache(@Param('id') assetId: string, @Query('regions') regions?: string) {
    const regionList = regions ? regions.split(",") : undefined
    await this.cdnService.purgeCache(assetId, regionList)
    return { message: "Cache purged successfully" }
  }

  @Get('cache/stats')
  async getCacheStats(@Query('region') region?: string) {
    return this.edgeCachingService.getCacheStats(region);
  }

  @Post("cache/warm/:id")
  async warmCache(@Param('id') assetId: string, @Query('url') url: string, @Query('regions') regions: string) {
    if (!url || !regions) {
      throw new BadRequestException("URL and regions are required")
    }

    const regionList = regions.split(",")
    await this.edgeCachingService.warmCache(assetId, url, regionList)
    return { message: "Cache warmed successfully" }
  }

  @Get('geo/location')
  async getLocation(@Query('ip') ip: string) {
    if (!ip) {
      throw new BadRequestException('IP address is required');
    }

    return this.geoLocationService.getLocationByIP(ip);
  }

  @Get('geo/edge-location')
  async getNearestEdge(@Query('ip') ip: string) {
    if (!ip) {
      throw new BadRequestException('IP address is required');
    }

    const location = await this.geoLocationService.getLocationByIP(ip);
    const nearestEdge = await this.geoLocationService.getNearestEdgeLocation(location);
    
    return { nearestEdge, location };
  }

  @Post("optimize/responsive")
  @UseInterceptors(FileInterceptor("file"))
  async generateResponsiveImages(file: Express.Multer.File, @Query('breakpoints') breakpoints?: string) {
    if (!file) {
      throw new BadRequestException("No file provided")
    }

    const breakpointList = breakpoints ? breakpoints.split(",").map((b) => Number.parseInt(b)) : undefined

    const results = await this.assetOptimizationService.generateResponsiveImages(file.buffer, breakpointList)

    return {
      original: file.size,
      variants: results.map((r) => ({
        width: r.width,
        size: r.buffer.length,
      })),
    }
  }
}
