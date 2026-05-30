import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HealthAggregationService } from './health-aggregation.service';

@ApiTags('health')
@Controller('health')
export class HealthAggregationController {
  constructor(private readonly healthAggregationService: HealthAggregationService) {}

  @Get()
  @ApiOperation({ summary: 'Aggregated health check for all services' })
  check() {
    return this.healthAggregationService.aggregate();
  }
}