import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('App')
@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: 'Get app status' })
  @ApiResponse({
    status: 200,
    description: 'App is running',
    schema: {
      example: {
        message: 'TeachLink API is running',
        timestamp: '2026-05-27T18:00:00.000Z',
      },
    },
  })
  getStatus() {
    return { message: 'TeachLink API is running', timestamp: new Date().toISOString() };
  }
}
