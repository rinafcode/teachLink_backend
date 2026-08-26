import {
  Controller,
  Get,
  Header,
  Query,
  BadRequestException,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiParam,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { DashboardService, RevenuePeriod } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  ConversionFunnelDto,
  CoursePerformanceDto,
  DashboardOverviewDto,
  InstructorDashboardDto,
  RevenueMetricsDto,
  UserGrowthDto,
} from './dto/dashboard-response.dto';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('instructor', 'admin')
@ApiResponse({ status: 401, description: 'Authentication required' })
@ApiResponse({ status: 403, description: 'Insufficient role (instructor or admin required)' })
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Business metrics dashboard overview' })
  @ApiResponse({
    status: 200,
    description: 'Aggregated dashboard overview',
    type: DashboardOverviewDto,
  })
  getOverview() {
    return this.dashboardService.getOverview();
  }

  @Get('revenue')
  @Roles('admin')
  @ApiOperation({ summary: 'Revenue metrics by period' })
  @ApiQuery({ name: 'period', enum: ['daily', 'weekly', 'monthly'], required: false })
  @ApiResponse({
    status: 200,
    description: 'Revenue metrics for the requested period',
    type: RevenueMetricsDto,
  })
  @ApiResponse({ status: 400, description: 'period must be daily, weekly, or monthly' })
  getRevenue(@Query('period') period?: string) {
    const p = (period ?? 'monthly') as RevenuePeriod;
    if (!['daily', 'weekly', 'monthly'].includes(p)) {
      throw new BadRequestException('period must be daily, weekly, or monthly');
    }
    return this.dashboardService.getRevenueMetrics(p);
  }

  @Get('users/growth')
  @ApiOperation({ summary: 'User growth metrics' })
  @ApiResponse({
    status: 200,
    description: 'Total users and monthly signup series',
    type: UserGrowthDto,
  })
  getUserGrowth() {
    return this.dashboardService.getUserGrowthMetrics();
  }

  @Get('courses/performance')
  @ApiOperation({ summary: 'Course performance metrics' })
  @ApiResponse({
    status: 200,
    description: 'Top courses ranked by enrollment',
    type: [CoursePerformanceDto],
  })
  getCoursePerformance() {
    return this.dashboardService.getCoursePerformanceMetrics();
  }

  @Get('funnel')
  @Roles('admin')
  @ApiOperation({ summary: 'Conversion funnel tracking' })
  @ApiResponse({
    status: 200,
    description: 'Conversion funnel stages and rates',
    type: ConversionFunnelDto,
  })
  getFunnel() {
    return this.dashboardService.getConversionFunnel();
  }

  @Get('instructors/:instructorId')
  @ApiOperation({ summary: 'Instructor course analytics dashboard' })
  @ApiParam({ name: 'instructorId', description: 'UUID of the instructor' })
  @ApiResponse({
    status: 200,
    description: 'Instructor analytics dashboard',
    type: InstructorDashboardDto,
  })
  @ApiResponse({ status: 404, description: 'Instructor not found' })
  async getInstructorDashboard(@Param('instructorId') instructorId: string) {
    return this.dashboardService.getInstructorDashboard(instructorId);
  }

  @Get('export/csv')
  @ApiOperation({ summary: 'Export dashboard metrics to CSV' })
  @ApiResponse({
    status: 200,
    description: 'CSV export of dashboard metrics',
    content: { 'text/csv': { schema: { type: 'string' } } },
  })
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="dashboard-metrics.csv"')
  async exportCsv(): Promise<string> {
    return this.dashboardService.exportToCsv();
  }
}
