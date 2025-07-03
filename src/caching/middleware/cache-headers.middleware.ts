import { Injectable, type NestMiddleware, Logger } from "@nestjs/common"
import type { Request, Response, NextFunction } from "express"
import type { CachingService } from "../caching.service"

@Injectable()
export class CacheHeadersMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CacheHeadersMiddleware.name)

  constructor(private readonly caching: CachingService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now()

    // Add cache control headers based on route
    this.setCacheHeaders(req, res)

    // Track response for analytics
    res.on("finish", () => {
      const responseTime = Date.now() - startTime
      const isError = res.statusCode >= 400

      // Record HTTP metrics for monitoring
      if (this.caching["metricsCollection"]) {
        this.caching["metricsCollection"].recordHttpRequest(responseTime, isError)
      }
    })

    next()
  }

  private setCacheHeaders(req: Request, res: Response): void {
    const path = req.path
    const method = req.method

    // Only cache GET requests
    if (method !== "GET") {
      res.set("Cache-Control", "no-cache, no-store, must-revalidate")
      return
    }

    // Set cache headers based on route patterns
    if (path.startsWith("/api/public/")) {
      // Public API - cache for 5 minutes
      res.set("Cache-Control", "public, max-age=300")
      res.set("ETag", this.generateETag(req))
    } else if (path.startsWith("/api/static/")) {
      // Static content - cache for 1 hour
      res.set("Cache-Control", "public, max-age=3600")
      res.set("ETag", this.generateETag(req))
    } else if (path.startsWith("/api/user/")) {
      // User-specific content - private cache for 1 minute
      res.set("Cache-Control", "private, max-age=60")
    } else {
      // Default - no cache
      res.set("Cache-Control", "no-cache")
    }
  }

  private generateETag(req: Request): string {
    const content = `${req.path}${JSON.stringify(req.query)}`
    return Buffer.from(content).toString("base64").substring(0, 16)
  }
}
