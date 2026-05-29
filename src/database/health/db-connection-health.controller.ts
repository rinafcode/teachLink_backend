import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DbConnectionHealthService } from './db-connection-health.service';

@ApiTags('database-health')
@Controller('database/health')
export class DbConnectionHealthController {
  constructor(private readonly dbHealthService: DbConnectionHealthService) {}

  @Get()
  @ApiOperation({ summary: 'Run a live database connection health check' })
  async check() {
    return this.dbHealthService.check();
  }

  @Get('latest')
  @ApiOperation({ summary: 'Return the cached result from the last background health check' })
  getLatest() {
    return this.dbHealthService.getLastResult() ?? { message: 'No check run yet' };
  }
}