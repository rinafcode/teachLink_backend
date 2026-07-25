import { Controller, Get } from '@nestjs/common';
import { CapacityPlanningService } from './capacity-planning.service';

@Controller('monitoring/capacity')
export class CapacityPlanningController {
  constructor(private readonly capacity: CapacityPlanningService) {}

  @Get('forecast')
  getForecast() {
    // return short forecast for next 60 minutes
    return this.capacity.forecastUtilizationMinutes(60);
  }

  @Get('recommendation')
  getRecommendation() {
    return this.capacity.getRecommendations();
  }
}
