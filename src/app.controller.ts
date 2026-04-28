import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { AnalyticsService } from './analytics/analytics.service';

@ApiTags('app')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly analyticsService: AnalyticsService,
  ) {}

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
