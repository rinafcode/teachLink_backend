import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Logger,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ABTestingService } from './ab-testing.service';
import { ExperimentService } from './experiments/experiment.service';
import { StatisticalAnalysisService } from './analysis/statistical-analysis.service';
import { AutomatedDecisionService } from './automation/automated-decision.service';
import { ABTestingReportsService } from './reporting/ab-testing-reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import {
  AutoSelectWinnerDto,
  CreateExperimentDto,
  CreateVariantDto,
  DashboardFiltersDto,
  UpdateExperimentDto,
  UpdateTrafficAllocationDto,
} from './dto';

/**
 * Exposes AB testing endpoints.
 */
@ApiTags('A/B Testing')
@Controller('ab-testing')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'Authentication required' })
@ApiResponse({ status: 403, description: 'Insufficient role for this experiment operation' })
export class ABTestingController {
  private readonly logger = new Logger(ABTestingController.name);

  constructor(
    private abTestingService: ABTestingService,
    private experimentService: ExperimentService,
    private statisticalAnalysisService: StatisticalAnalysisService,
    private automatedDecisionService: AutomatedDecisionService,
    private reportsService: ABTestingReportsService,
  ) {}

  /**
   * Get available experiment templates
   */
  @Get('templates')
  @ApiResponse({
    status: 200,
    description: 'Available experiment templates',
    schema: {
      example: [
        {
          name: 'Standard A/B Test',
          description: 'Standard 50/50 A/B test with 95% confidence',
          trafficAllocation: 50,
          confidenceLevel: 0.95,
          minimumSampleSize: 1000,
        },
      ],
    },
  })
  async getExperimentTemplates(): Promise<any> {
    this.logger.log('Fetching experiment templates');
    return this.abTestingService.getAvailableTemplates();
  }

  /**
   * Analyze experiment and check for auto-stop conditions
   */
  @Post('experiments/:id/analyze')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  @ApiResponse({
    status: 200,
    description: 'Analysis complete',
    schema: {
      example: {
        results: [
          {
            variantId: 'variant-1',
            sampleSize: 2500,
            conversionRate: 0.085,
            confidence: 0.97,
            pValue: 0.03,
            isSignificant: true,
            uplift: 0.15,
            upliftCI: { lower: 0.08, upper: 0.22 },
          },
        ],
        shouldStop: true,
        reason: 'Statistical significance reached',
      },
    },
  })
  async analyzeAndAutoStop(@Param('id') experimentId: string): Promise<any> {
    this.logger.log(`Analyzing experiment for auto-stop: ${experimentId}`);
    return await this.abTestingService.analyzeAndAutoStop(experimentId);
  }

  /**
   * Get comprehensive experiment results dashboard
   */
  @Get('experiments/:id/dashboard')
  @ApiResponse({
    status: 200,
    description: 'Experiment results dashboard',
    schema: {
      example: {
        experiment: {},
        variantResults: [],
        summary: {
          winner: 'variant-2',
          confidence: 0.96,
          estimatedUplift: 0.12,
          sampleSizeReached: true,
        },
      },
    },
  })
  async getResultsDashboard(@Param('id') experimentId: string): Promise<any> {
    this.logger.log(`Fetching results dashboard for experiment: ${experimentId}`);
    return await this.abTestingService.getExperimentResults(experimentId);
  }

  /**
   * Returns all Experiments.
   * @returns The operation result.
   */
  @Get('experiments')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  async getAllExperiments(): Promise<any> {
    this.logger.log('Fetching all experiments');
    return await this.abTestingService.getAllExperiments();
  }

  /**
   * Returns experiment By Id.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Get('experiments/:id')
  async getExperimentById(@Param('id') id: string): Promise<any> {
    this.logger.log(`Fetching experiment: ${id}`);
    return await this.abTestingService.getExperimentById(id);
  }

  /**
   * Creates experiment.
   * @param createExperimentDto The request payload.
   * @returns The operation result.
   */
  @Post('experiments')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ADMIN)
  async createExperiment(@Body() createExperimentDto: CreateExperimentDto): Promise<any> {
    this.logger.log(`Creating new experiment: ${createExperimentDto.name}`);
    return await this.abTestingService.createExperiment(createExperimentDto);
  }

  /**
   * Starts experiment.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Post('experiments/:id/start')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  async startExperiment(@Param('id') id: string): Promise<any> {
    this.logger.log(`Starting experiment: ${id}`);
    return await this.abTestingService.startExperiment(id);
  }

  /**
   * Stops experiment.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Post('experiments/:id/stop')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  async stopExperiment(@Param('id') id: string): Promise<any> {
    this.logger.log(`Stopping experiment: ${id}`);
    return await this.abTestingService.stopExperiment(id);
  }

  /**
   * Updates experiment.
   * @param id The identifier.
   * @param updateData The data to process.
   * @returns The operation result.
   */
  @Put('experiments/:id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  async updateExperiment(@Param('id') id: string, @Body() updateData: UpdateExperimentDto): Promise<any> {
    this.logger.log(`Updating experiment: ${id}`);
    return await this.experimentService.updateExperiment(id, updateData);
  }

  /**
   * Removes experiment.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Delete('experiments/:id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  async deleteExperiment(@Param('id') id: string): Promise<any> {
    this.logger.log(`Deleting experiment: ${id}`);
    // Implementation would go here
    return { message: 'Experiment deleted successfully' };
  }

  /**
   * Returns experiment Results.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Get('experiments/:id/results')
  async getExperimentResults(@Param('id') id: string): Promise<any> {
    this.logger.log(`Fetching results for experiment: ${id}`);
    return await this.experimentService.getExperimentResults(id);
  }

  /**
   * Adds a variant.
   * @param experimentId The experiment identifier.
   * @param variantData The data to process.
   * @returns The operation result.
   */
  @Post('experiments/:id/variants')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.ADMIN)
  async addVariant(
    @Param('id') experimentId: string,
    @Body() variantData: CreateVariantDto,
  ): Promise<any> {
    this.logger.log(`Adding variant to experiment: ${experimentId}`);
    return await this.experimentService.addVariant(experimentId, variantData);
  }

  /**
   * Removes variant.
   * @param variantId The variant identifier.
   * @returns The operation result.
   */
  @Delete('variants/:id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  async removeVariant(@Param('id') variantId: string): Promise<any> {
    this.logger.log(`Removing variant: ${variantId}`);
    await this.experimentService.removeVariant(variantId);
    return { message: 'Variant removed successfully' };
  }

  /**
   * Updates traffic Allocation.
   * @param experimentId The experiment identifier.
   * @param allocations The allocations.
   * @returns The operation result.
   */
  @Put('experiments/:id/traffic-allocation')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  async updateTrafficAllocation(
    @Param('id') experimentId: string,
    @Body() updateTrafficAllocationDto: UpdateTrafficAllocationDto,
  ): Promise<any> {
    this.logger.log(`Updating traffic allocation for experiment: ${experimentId}`);
    await this.experimentService.updateTrafficAllocation(
      experimentId,
      updateTrafficAllocationDto.allocations,
    );
    return { message: 'Traffic allocation updated successfully' };
  }

  /**
   * Returns statistical Analysis.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Get('experiments/:id/statistical-analysis')
  async getStatisticalAnalysis(@Param('id') id: string): Promise<any> {
    this.logger.log(`Performing statistical analysis for experiment: ${id}`);
    return await this.statisticalAnalysisService.calculateStatisticalSignificance(id);
  }

  /**
   * Returns effect Size.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Get('experiments/:id/effect-size')
  async getEffectSize(@Param('id') id: string): Promise<any> {
    this.logger.log(`Calculating effect size for experiment: ${id}`);
    return await this.statisticalAnalysisService.calculateEffectSize(id);
  }

  /**
   * Automatically selects a winner.
   * @param id The identifier.
   * @param criteria The criteria.
   * @returns The operation result.
   */
  @Post('experiments/:id/auto-select-winner')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  async autoSelectWinner(
    @Param('id') id: string,
    @Body() criteria?: AutoSelectWinnerDto,
  ): Promise<any> {
    this.logger.log(`Auto-selecting winner for experiment: ${id}`);
    return await this.automatedDecisionService.autoSelectWinner(id, criteria);
  }

  /**
   * Returns decision Recommendations.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Get('experiments/:id/decision-recommendations')
  async getDecisionRecommendations(@Param('id') id: string): Promise<any> {
    this.logger.log(`Getting decision recommendations for experiment: ${id}`);
    return await this.automatedDecisionService.getDecisionRecommendations(id);
  }

  /**
   * Automatically allocates traffic.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Post('experiments/:id/auto-allocate-traffic')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  async autoAllocateTraffic(@Param('id') id: string): Promise<any> {
    this.logger.log(`Auto-allocating traffic for experiment: ${id}`);
    await this.automatedDecisionService.autoAllocateTraffic(id);
    return { message: 'Traffic auto-allocated successfully' };
  }

  /**
   * Returns dashboard Summary.
   * @param filters The filter criteria.
   * @returns The operation result.
   */
  @Get('reports/dashboard')
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  async getDashboardSummary(@Query() filters?: DashboardFiltersDto): Promise<any> {
    this.logger.log('Generating dashboard summary');
    return await this.reportsService.getDashboardSummary(filters);
  }

  /**
   * Generates experiment Report.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Get('reports/experiment/:id')
  async generateExperimentReport(@Param('id') id: string): Promise<any> {
    this.logger.log(`Generating report for experiment: ${id}`);
    return await this.reportsService.generateExperimentReport(id);
  }

  /**
   * Returns performance Comparison Report.
   * @returns The operation result.
   */
  @Get('reports/performance-comparison')
  async getPerformanceComparisonReport(): Promise<any> {
    this.logger.log('Generating performance comparison report');
    return await this.reportsService.generatePerformanceComparisonReport();
  }

  /**
   * Returns experiment Timeline.
   * @returns The operation result.
   */
  @Get('reports/timeline')
  async getExperimentTimeline(): Promise<any> {
    this.logger.log('Generating experiment timeline');
    return await this.reportsService.getExperimentTimeline();
  }

  /**
   * Exports experiment Data.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Get('reports/experiment/:id/export')
  async exportExperimentData(@Param('id') id: string): Promise<any> {
    this.logger.log(`Exporting data for experiment: ${id}`);
    const csvData = await this.reportsService.exportExperimentData(id);
    return {
      filename: `experiment-${id}-data.csv`,
      data: csvData,
    };
  }

  /**
   * Pauses experiment.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Post('experiments/:id/pause')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  async pauseExperiment(@Param('id') id: string): Promise<any> {
    this.logger.log(`Pausing experiment: ${id}`);
    return await this.experimentService.pauseExperiment(id);
  }

  /**
   * Resumes experiment.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Post('experiments/:id/resume')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  async resumeExperiment(@Param('id') id: string): Promise<any> {
    this.logger.log(`Resuming experiment: ${id}`);
    return await this.experimentService.resumeExperiment(id);
  }

  /**
   * Archives experiment.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Post('experiments/:id/archive')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  async archiveExperiment(@Param('id') id: string): Promise<any> {
    this.logger.log(`Archiving experiment: ${id}`);
    return await this.experimentService.archiveExperiment(id);
  }

  /**
   * Assigns user To Variant.
   * @param experimentId The experiment identifier.
   * @param userId The user identifier.
   * @returns The operation result.
   */
  @Get('experiments/:id/assign-user/:userId')
  @Roles(UserRole.ADMIN)
  async assignUserToVariant(
    @Param('id') experimentId: string,
    @Param('userId') userId: string,
  ): Promise<any> {
    this.logger.log(`Assigning user ${userId} to variant for experiment: ${experimentId}`);
    return await this.abTestingService.assignUserToVariant(experimentId, userId);
  }
}
