import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipQuota } from './rate-limiting/decorators/quota.decorator';

@ApiTags('App')
@SkipQuota()
@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: 'Get app status' })
  @ApiResponse({ status: 200, description: 'App is running' })
  getStatus() {
    return { message: 'TeachLink API is running', timestamp: new Date().toISOString() };
  }
}
