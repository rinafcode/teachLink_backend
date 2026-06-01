import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GracefulShutdownService } from '../../common/services/graceful-shutdown.service';
import { RequestTrackerService } from '../../common/services/request-tracker.service';
import { DatabaseShutdownService } from '../../database/services/database-shutdown.service';
import { WorkerShutdownService } from '../../workers/services/worker-shutdown.service';
import { ShutdownStateService } from '../../common/services/shutdown-state.service';

export interface ShutdownHealthResponse {
  status: 'healthy' | 'shutting_down' | 'unhealthy';
  timestamp: string;
  shutdown: {
    isShuttingDown: boolean;
    startTime: number | null;
    reason: string | null;
    durationMs: number | null;
  };
  requests: {
    activeCount: number;
    longestRunningMs: number;
  };
  database: {
    isShuttingDown: boolean;
    poolUtilization: number;
  };
  workers: {
    isShuttingDown: boolean;
    phase: string;
    activeJobs: number;
    totalWorkers: number;
  };
  readiness: {
    acceptingRequests: boolean;
    acceptingJobs: boolean;
    databaseReady: boolean;
  };
}

/**
 * Health check endpoint for monitoring shutdown status and readiness
 */
@ApiTags('Health')
@Controller('health/shutdown')
export class ShutdownHealthController {
  constructor(
    private readonly gracefulShutdown: GracefulShutdownService,
    private readonly requestTracker: RequestTrackerService,
    private readonly databaseShutdown: DatabaseShutdownService,
    private readonly workerShutdown: WorkerShutdownService,
    private readonly shutdownState: ShutdownStateService,
  ) {}

  @Get()
  @ApiOperation({ 
    summary: 'Get shutdown health status',
    description: 'Returns detailed information about the application shutdown state and readiness'
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Shutdown health status retrieved successfully'
  })
  async getShutdownHealth(): Promise<ShutdownHealthResponse> {
    const shutdownInfo = this.shutdownState.getShutdownInfo();
    const requestStats = this.requestTracker.getStatistics();
    const databaseStatus = this.databaseShutdown.getShutdownStatus();
    const workerStatus = this.workerShutdown.getShutdownStatus();
    const gracefulStatus = this.gracefulShutdown.getShutdownStatus();

    const isShuttingDown = shutdownInfo.isShuttingDown;
    const hasActiveRequests = requestStats.activeCount > 0;
    const hasActiveJobs = workerStatus.activeJobs > 0;
    const databaseReady = !databaseStatus.isShuttingDown && databaseStatus.poolSnapshot.utilizationPct < 90;

    // Determine overall status
    let status: 'healthy' | 'shutting_down' | 'unhealthy';
    if (isShuttingDown) {
      status = 'shutting_down';
    } else if (databaseReady && requestStats.activeCount < 100) {
      status = 'healthy';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      shutdown: shutdownInfo,
      requests: {
        activeCount: requestStats.activeCount,
        longestRunningMs: requestStats.longestRunningMs,
      },
      database: {
        isShuttingDown: databaseStatus.isShuttingDown,
        poolUtilization: databaseStatus.poolSnapshot.utilizationPct,
      },
      workers: {
        isShuttingDown: workerStatus.isShuttingDown,
        phase: workerStatus.phase,
        activeJobs: workerStatus.activeJobs,
        totalWorkers: workerStatus.totalWorkers,
      },
      readiness: {
        acceptingRequests: !isShuttingDown && !hasActiveRequests,
        acceptingJobs: !isShuttingDown && !hasActiveJobs,
        databaseReady,
      },
    };
  }

  @Get('detailed')
  @ApiOperation({ 
    summary: 'Get detailed shutdown status',
    description: 'Returns comprehensive shutdown information for debugging'
  })
  async getDetailedShutdownStatus(): Promise<any> {
    const [
      shutdownInfo,
      requestStats,
      activeRequests,
      databaseStatus,
      workerDetailedStatus,
      gracefulStatus,
    ] = await Promise.all([
      this.shutdownState.getShutdownInfo(),
      this.requestTracker.getStatistics(),
      this.requestTracker.getActiveRequests(),
      this.databaseShutdown.getShutdownStatus(),
      this.workerShutdown.getDetailedStatus(),
      this.gracefulShutdown.getShutdownStatus(),
    ]);

    return {
      timestamp: new Date().toISOString(),
      shutdown: shutdownInfo,
      gracefulShutdown: gracefulStatus,
      requests: {
        statistics: requestStats,
        activeRequests: activeRequests.map(req => ({
          id: req.id,
          method: req.method,
          url: req.url,
          durationMs: Date.now() - req.startTime,
          correlationId: req.correlationId,
        })),
      },
      database: databaseStatus,
      workers: workerDetailedStatus,
    };
  }

  @Get('readiness')
  @ApiOperation({ 
    summary: 'Check if application is ready for shutdown',
    description: 'Returns readiness status for load balancer health checks'
  })
  async getReadinessStatus(): Promise<{
    ready: boolean;
    reason?: string;
    activeRequests: number;
    activeJobs: number;
  }> {
    const shutdownInfo = this.shutdownState.getShutdownInfo();
    const requestStats = this.requestTracker.getStatistics();
    const workerStatus = this.workerShutdown.getShutdownStatus();

    const isShuttingDown = shutdownInfo.isShuttingDown;
    const hasActiveRequests = requestStats.activeCount > 0;
    const hasActiveJobs = workerStatus.activeJobs > 0;

    let ready = true;
    let reason: string | undefined;

    if (isShuttingDown) {
      ready = false;
      reason = 'Application is shutting down';
    } else if (hasActiveRequests) {
      ready = false;
      reason = `${requestStats.activeCount} active requests`;
    } else if (hasActiveJobs) {
      ready = false;
      reason = `${workerStatus.activeJobs} active jobs`;
    }

    return {
      ready,
      reason,
      activeRequests: requestStats.activeCount,
      activeJobs: workerStatus.activeJobs,
    };
  }
}