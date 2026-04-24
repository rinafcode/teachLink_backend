import { Controller, Get, HttpStatus, ApiResponse, ApiTags } from '@nestjs/common';
import { AppService } from './app.service';

@ApiTags('app')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiResponse({ status: HttpStatus.OK, description: 'Root endpoint response' })
  getHello(): string {
    return this.appService.getHello();
  }
}
