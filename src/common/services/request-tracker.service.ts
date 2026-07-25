import { Injectable, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export interface ActiveRequest {
  id: string;
  method: string;
  url: string;
  startTime: number;
  userAgent?: string;
  correlationId?: string;
}

/**
 * Tracks active HTTP requests to ensure graceful completion during shutdown
 */
@Injectable()
export class RequestTrackerService {
  private readonly logger = new Logger(RequestTrackerService.name);
  private readonly activeRequests = new Map<string, ActiveRequest>();
  private requestCounter = 0;

  /**
   * Express middleware to track incoming requests
   */
  trackRequest() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const requestId = this.generateRequestId();
      const startTime = Date.now();

      const activeRequest: ActiveRequest = {
        id: requestId,
        method: req.method,
        url: req.url,
        startTime,
        userAgent: req.get('User-Agent'),
        correlationId: req.get('X-Correlation-ID'),
      };

      // Store the request
      this.activeRequests.set(requestId, activeRequest);

      // Store request ID in response locals for cleanup
      res.locals.requestId = requestId;

      this.logger.debug(`Request started: ${requestId} ${req.method} ${req.url}`);

      // Clean up when response finishes
      const cleanup = () => {
        const duration = Date.now() - startTime;
        this.activeRequests.delete(requestId);
        this.logger.debug(`Request completed: ${requestId} in ${duration}ms`);
      };

      res.on('finish', cleanup);
      res.on('close', cleanup);
      res.on('error', cleanup);

      next();
    };
  }

  /**
   * Wait for all active requests to complete
   */
  async waitForActiveRequests(timeoutMs: number = 30000): Promise<void> {
    const activeCount = this.activeRequests.size;

    if (activeCount === 0) {
      this.logger.log('No active requests to wait for');
      return;
    }

    this.logger.log(`Waiting for ${activeCount} active requests to complete...`);

    const startTime = Date.now();
    const checkInterval = 100; // Check every 100ms

    return new Promise((resolve, reject) => {
      const timeoutTimer = setTimeout(() => {
        const remainingRequests = this.activeRequests.size;
        const waitTime = Date.now() - startTime;

        if (remainingRequests > 0) {
          this.logger.warn(
            `Timeout waiting for requests after ${waitTime}ms. ${remainingRequests} requests still active:`,
          );
          this.logActiveRequests();
        }

        reject(new Error(`Timeout waiting for ${remainingRequests} active requests`));
      }, timeoutMs);

      const checkCompletion = () => {
        if (this.activeRequests.size === 0) {
          clearTimeout(timeoutTimer);
          const waitTime = Date.now() - startTime;
          this.logger.log(`All requests completed after ${waitTime}ms`);
          resolve();
        } else {
          setTimeout(checkCompletion, checkInterval);
        }
      };

      checkCompletion();
    });
  }

  /**
   * Get current active request count
   */
  getActiveRequestCount(): number {
    return this.activeRequests.size;
  }

  /**
   * Get detailed information about active requests
   */
  getActiveRequests(): ActiveRequest[] {
    return Array.from(this.activeRequests.values());
  }

  /**
   * Log information about currently active requests
   */
  logActiveRequests(): void {
    const requests = this.getActiveRequests();

    if (requests.length === 0) {
      this.logger.log('No active requests');
      return;
    }

    this.logger.log(`Active requests (${requests.length}):`);

    requests.forEach((req) => {
      const duration = Date.now() - req.startTime;
      this.logger.log(
        `  - ${req.id}: ${req.method} ${req.url} (${duration}ms) [${req.correlationId || 'no-correlation'}]`,
      );
    });
  }

  /**
   * Force cleanup of a specific request (emergency use only)
   */
  forceCleanupRequest(requestId: string): boolean {
    const existed = this.activeRequests.has(requestId);
    this.activeRequests.delete(requestId);

    if (existed) {
      this.logger.warn(`Force cleaned up request: ${requestId}`);
    }

    return existed;
  }

  /**
   * Get statistics about request tracking
   */
  getStatistics(): {
    activeCount: number;
    totalProcessed: number;
    longestRunningMs: number;
    averageDurationMs: number;
  } {
    const activeRequests = this.getActiveRequests();
    const now = Date.now();

    let longestRunning = 0;
    let totalDuration = 0;

    activeRequests.forEach((req) => {
      const duration = now - req.startTime;
      longestRunning = Math.max(longestRunning, duration);
      totalDuration += duration;
    });

    return {
      activeCount: activeRequests.length,
      totalProcessed: this.requestCounter,
      longestRunningMs: longestRunning,
      averageDurationMs: activeRequests.length > 0 ? totalDuration / activeRequests.length : 0,
    };
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    this.requestCounter++;
    return `req-${Date.now()}-${this.requestCounter}-${Math.random().toString(36).substr(2, 6)}`;
  }
}
