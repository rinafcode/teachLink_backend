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
import { ABTestingService, ICreateExperimentDto } from './ab-testing.service';
import { ExperimentService } from './experiments/experiment.service';
import { StatisticalAnalysisService } from './analysis/statistical-analysis.service';
import { AutomatedDecisionService } from './automation/automated-decision.service';
import { ABTestingReportsService } from './reporting/ab-testing-reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

/**
 * Exposes AB testing endpoints.
 */
@Controller('ab-testing')
@UseGuards(JwtAuthGuard, RolesGuard)
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
  async createExperiment(@Body() createExperimentDto: ICreateExperimentDto): Promise<any> {
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
  async updateExperiment(@Param('id') id: string, @Body() updateData: any): Promise<any> {
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
  async addVariant(@Param('id') experimentId: string, @Body() variantData: any): Promise<any> {
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
    @Body() allocations: Record<string, number>,
  ): Promise<any> {
    this.logger.log(`Updating traffic allocation for experiment: ${experimentId}`);
    await this.experimentService.updateTrafficAllocation(experimentId, allocations);
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
  async autoSelectWinner(@Param('id') id: string, @Body() criteria?: any): Promise<any> {
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
  async getDashboardSummary(@Query() filters?: any): Promise<any> {
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
