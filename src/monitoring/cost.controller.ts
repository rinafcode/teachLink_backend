import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CostTrackingService } from './cost-tracking.service';
import { RecordCostDto } from './dto/record-cost.dto';

@ApiTags('Metrics')
@Controller()
export class CostController {
  constructor(private readonly costTrackingService: CostTrackingService) {}

  @Post('metrics/cost')
  @ApiOperation({ summary: 'Record an hourly infrastructure cost event' })
  @ApiResponse({ status: 201, description: 'Cost recorded successfully' })
  async recordCost(@Body() dto: RecordCostDto): Promise<{ success: boolean }> {
    await this.costTrackingService.recordHourlyCost(dto.amountUsd);
    return { success: true };
  }

  @Get('monitoring/cost/summary')
  @ApiOperation({ summary: 'Get 24h infrastructure cost summary' })
  @ApiResponse({ status: 200, description: 'Returns last 24h spend and average hourly cost' })
  async getCostSummary(): Promise<{ last24hUsd: number; avgHourlyUsd: number }> {
    return {
      last24hUsd: this.costTrackingService.getLast24hCost(),
      avgHourlyUsd: this.costTrackingService.getAverageHourlyCost(),
    };
  }
}
