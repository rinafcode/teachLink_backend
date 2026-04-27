import { Controller, Get, HttpStatus } from '@nestjs/common';
import { IApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('app')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @IApiResponse({ status: HttpStatus.OK, description: 'Root endpoint response' })
  getHello(): string {
    return this.appService.getHello();
  }
}
