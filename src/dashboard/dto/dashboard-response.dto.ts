import { ApiProperty } from '@nestjs/swagger';

/**
 * Typed response schemas for the dashboard endpoints so the generated Swagger
 * documentation renders accurate models instead of opaque `object` payloads.
 */

export class RevenueSummaryDto {
  @ApiProperty({ example: 12500.75, description: 'Gross revenue for the period' })
  grossRevenue: number;

  @ApiProperty({ example: 11200.5, description: 'Net revenue after refunds/fees' })
  netRevenue: number;

  @ApiProperty({ example: 1300.25, description: 'Total refunds issued in the period' })
  totalRefunds: number;

  @ApiProperty({ example: 'USD', description: 'ISO 4217 currency code' })
  currency: string;
}

export class RevenueBucketDto {
  @ApiProperty({ example: '2025-01', description: 'Bucket label for the period' })
  period: string;

  @ApiProperty({ example: 4200.5, description: 'Revenue recognised within the bucket' })
  amount: number;
}

export class RevenueMetricsDto {
  @ApiProperty({ enum: ['daily', 'weekly', 'monthly'], example: 'monthly' })
  period: 'daily' | 'weekly' | 'monthly';

  @ApiProperty({ type: [RevenueBucketDto] })
  buckets: RevenueBucketDto[];

  @ApiProperty({ type: RevenueSummaryDto })
  summary: RevenueSummaryDto;
}

export class MonthlySignupDto {
  @ApiProperty({ example: '2025-01' })
  period: string;

  @ApiProperty({ example: 320, description: 'New users registered in the month' })
  newUsers: number;

  @ApiProperty({ example: 5400, description: 'Cumulative users up to and including the month' })
  totalUsers: number;
}

export class UserGrowthDto {
  @ApiProperty({ example: 5400 })
  totalUsers: number;

  @ApiProperty({ type: [MonthlySignupDto] })
  monthlySignups: MonthlySignupDto[];
}

export class CoursePerformanceDto {
  @ApiProperty({ example: 'c1a2b3', format: 'uuid' })
  courseId: string;

  @ApiProperty({ example: 'Intro to TypeScript' })
  title: string;

  @ApiProperty({ example: 1280, description: 'Number of enrollments' })
  enrollments: number;

  @ApiProperty({ example: 49.99 })
  price: number;

  @ApiProperty({ example: 'published' })
  status: string;
}

export class FunnelStageDto {
  @ApiProperty({ example: 'signup' })
  name: string;

  @ApiProperty({ example: 5400 })
  count: number;
}

export class FunnelConversionRatesDto {
  @ApiProperty({ example: 0.42 })
  signupToEnrollment: number;

  @ApiProperty({ example: 0.65 })
  enrollmentToPayment: number;

  @ApiProperty({ example: 0.58 })
  paymentToCompletion: number;
}

export class ConversionFunnelDto {
  @ApiProperty({ type: [FunnelStageDto] })
  stages: FunnelStageDto[];

  @ApiProperty({ type: FunnelConversionRatesDto })
  conversionRates: FunnelConversionRatesDto;
}

export class DashboardOverviewDto {
  @ApiProperty({ type: RevenueMetricsDto })
  revenue: RevenueMetricsDto;

  @ApiProperty({ type: UserGrowthDto })
  userGrowth: UserGrowthDto;

  @ApiProperty({ type: [CoursePerformanceDto] })
  coursePerformance: CoursePerformanceDto[];

  @ApiProperty({ type: ConversionFunnelDto })
  funnel: ConversionFunnelDto;

  @ApiProperty({ example: '2025-01-31T12:00:00.000Z', description: 'ISO timestamp of generation' })
  generatedAt: string;
}

export class InstructorDashboardDto {
  @ApiProperty({ example: 'c1a2b3', format: 'uuid' })
  instructorId: string;

  @ApiProperty({
    description: 'Revenue breakdown for the instructor',
    type: 'object',
    additionalProperties: true,
  })
  revenue: Record<string, unknown>;

  @ApiProperty({ description: 'Enrollment trend series', type: 'array', items: { type: 'object' } })
  enrollmentTrends: unknown[];

  @ApiProperty({ example: 0.73, description: 'Average course completion rate (0–1)' })
  completionRate: number;

  @ApiProperty({
    description: 'Aggregated video watch-time metrics',
    type: 'object',
    additionalProperties: true,
  })
  videoWatchTime: Record<string, unknown>;

  @ApiProperty({ description: 'Per-course summary rows', type: 'array', items: { type: 'object' } })
  courseSummary: unknown[];
}
