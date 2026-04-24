import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiTags, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';
import { AnalyticsService } from './analytics/analytics.service';

/**
 * Exposes app endpoints.
 */
@ApiTags('app')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  /**
   * Returns hello.
   * @returns The resulting string value.
   */
  @Get()
  @ApiResponse({ status: HttpStatus.OK, description: 'Root endpoint response' })
  getHello(): string {
    // Record a lightweight analytics event for root endpoint hits
    try {
      this.analyticsService.recordEvent('endpoint', 'root_hit');
    } catch {
      // swallow analytics errors to avoid impacting the root endpoint
    }

    return this.appService.getHello();
  }
}
