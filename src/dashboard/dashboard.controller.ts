import { Controller, Get, Header, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DashboardService, RevenuePeriod } from './dashboard.service';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Business metrics dashboard overview' })
  getOverview() {
    return this.dashboardService.getOverview();
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Revenue metrics by period' })
  @ApiQuery({ name: 'period', enum: ['daily', 'weekly', 'monthly'], required: false })
  getRevenue(@Query('period') period?: string) {
    const p = (period ?? 'monthly') as RevenuePeriod;
    if (!['daily', 'weekly', 'monthly'].includes(p)) {
      throw new BadRequestException('period must be daily, weekly, or monthly');
    }
    return this.dashboardService.getRevenueMetrics(p);
  }

  @Get('users/growth')
  @ApiOperation({ summary: 'User growth metrics' })
  getUserGrowth() {
    return this.dashboardService.getUserGrowthMetrics();
  }

  @Get('courses/performance')
  @ApiOperation({ summary: 'Course performance metrics' })
  getCoursePerformance() {
    return this.dashboardService.getCoursePerformanceMetrics();
  }

  @Get('funnel')
  @ApiOperation({ summary: 'Conversion funnel tracking' })
  getFunnel() {
    return this.dashboardService.getConversionFunnel();
  }

  @Get('export/csv')
  @ApiOperation({ summary: 'Export dashboard metrics to CSV' })
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="dashboard-metrics.csv"')
  async exportCsv(): Promise<string> {
    return this.dashboardService.exportToCsv();
  }
}
