import { Controller, Get, Post, Put, Delete, Param, Body, Query, Logger, HttpCode, HttpStatus } from '@nestjs/common';
import { ABTestingService } from './ab-testing.service';
import { ExperimentService } from './experiments/experiment.service';
import { StatisticalAnalysisService } from './analysis/statistical-analysis.service';
import { AutomatedDecisionService } from './automation/automated-decision.service';
import { ABTestingReportsService } from './reporting/ab-testing-reports.service';
import { CreateExperimentDto } from './ab-testing.service';
import { ExperimentStatus, ExperimentType } from './entities/experiment.entity';

@Controller('ab-testing')
export class ABTestingController {
  private readonly logger = new Logger(ABTestingController.name);

  constructor(
    private abTestingService: ABTestingService,
    private experimentService: ExperimentService,
    private statisticalAnalysisService: StatisticalAnalysisService,
    private automatedDecisionService: AutomatedDecisionService,
    private reportsService: ABTestingReportsService,
  ) {}

  @Get('experiments')
  async getAllExperiments() {
    this.logger.log('Fetching all experiments');
    return await this.abTestingService.getAllExperiments();
  }

  @Get('experiments/:id')
  async getExperimentById(@Param('id') id: string) {
    this.logger.log(`Fetching experiment: ${id}`);
    return await this.abTestingService.getExperimentById(id);
  }

  @Post('experiments')
  @HttpCode(HttpStatus.CREATED)
  async createExperiment(@Body() createExperimentDto: CreateExperimentDto) {
    this.logger.log(`Creating new experiment: ${createExperimentDto.name}`);
    return await this.abTestingService.createExperiment(createExperimentDto);
  }

  @Post('experiments/:id/start')
  @HttpCode(HttpStatus.OK)
  async startExperiment(@Param('id') id: string) {
    this.logger.log(`Starting experiment: ${id}`);
    return await this.abTestingService.startExperiment(id);
  }

  @Post('experiments/:id/stop')
  @HttpCode(HttpStatus.OK)
  async stopExperiment(@Param('id') id: string) {
    this.logger.log(`Stopping experiment: ${id}`);
    return await this.abTestingService.stopExperiment(id);
  }

  @Put('experiments/:id')
  @HttpCode(HttpStatus.OK)
  async updateExperiment(
    @Param('id') id: string,
    @Body() updateData: any
  ) {
    this.logger.log(`Updating experiment: ${id}`);
    return await this.experimentService.updateExperiment(id, updateData);
  }

  @Delete('experiments/:id')
  @HttpCode(HttpStatus.OK)
  async deleteExperiment(@Param('id') id: string) {
    this.logger.log(`Deleting experiment: ${id}`);
    // Implementation would go here
    return { message: 'Experiment deleted successfully' };
  }

  @Get('experiments/:id/results')
  async getExperimentResults(@Param('id') id: string) {
    this.logger.log(`Fetching results for experiment: ${id}`);
    return await this.experimentService.getExperimentResults(id);
  }

  @Post('experiments/:id/variants')
  @HttpCode(HttpStatus.CREATED)
  async addVariant(
    @Param('id') experimentId: string,
    @Body() variantData: any
  ) {
    this.logger.log(`Adding variant to experiment: ${experimentId}`);
    return await this.experimentService.addVariant(experimentId, variantData);
  }

  @Delete('variants/:id')
  @HttpCode(HttpStatus.OK)
  async removeVariant(@Param('id') variantId: string) {
    this.logger.log(`Removing variant: ${variantId}`);
    await this.experimentService.removeVariant(variantId);
    return { message: 'Variant removed successfully' };
  }

  @Put('experiments/:id/traffic-allocation')
  @HttpCode(HttpStatus.OK)
  async updateTrafficAllocation(
    @Param('id') experimentId: string,
    @Body() allocations: Record<string, number>
  ) {
    this.logger.log(`Updating traffic allocation for experiment: ${experimentId}`);
    await this.experimentService.updateTrafficAllocation(experimentId, allocations);
    return { message: 'Traffic allocation updated successfully' };
  }

  @Get('experiments/:id/statistical-analysis')
  async getStatisticalAnalysis(@Param('id') id: string) {
    this.logger.log(`Performing statistical analysis for experiment: ${id}`);
    return await this.statisticalAnalysisService.calculateStatisticalSignificance(id);
  }

  @Get('experiments/:id/effect-size')
  async getEffectSize(@Param('id') id: string) {
    this.logger.log(`Calculating effect size for experiment: ${id}`);
    return await this.statisticalAnalysisService.calculateEffectSize(id);
  }

  @Post('experiments/:id/auto-select-winner')
  @HttpCode(HttpStatus.OK)
  async autoSelectWinner(
    @Param('id') id: string,
    @Body() criteria?: any
  ) {
    this.logger.log(`Auto-selecting winner for experiment: ${id}`);
    return await this.automatedDecisionService.autoSelectWinner(id, criteria);
  }

  @Get('experiments/:id/decision-recommendations')
  async getDecisionRecommendations(@Param('id') id: string) {
    this.logger.log(`Getting decision recommendations for experiment: ${id}`);
    return await this.automatedDecisionService.getDecisionRecommendations(id);
  }

  @Post('experiments/:id/auto-allocate-traffic')
  @HttpCode(HttpStatus.OK)
  async autoAllocateTraffic(@Param('id') id: string) {
    this.logger.log(`Auto-allocating traffic for experiment: ${id}`);
    await this.automatedDecisionService.autoAllocateTraffic(id);
    return { message: 'Traffic auto-allocated successfully' };
  }

  @Get('reports/dashboard')
  async getDashboardSummary(@Query() filters?: any) {
    this.logger.log('Generating dashboard summary');
    return await this.reportsService.getDashboardSummary(filters);
  }

  @Get('reports/experiment/:id')
  async generateExperimentReport(@Param('id') id: string) {
    this.logger.log(`Generating report for experiment: ${id}`);
    return await this.reportsService.generateExperimentReport(id);
  }

  @Get('reports/performance-comparison')
  async getPerformanceComparisonReport() {
    this.logger.log('Generating performance comparison report');
    return await this.reportsService.generatePerformanceComparisonReport();
  }

  @Get('reports/timeline')
  async getExperimentTimeline() {
    this.logger.log('Generating experiment timeline');
    return await this.reportsService.getExperimentTimeline();
  }

  @Get('reports/experiment/:id/export')
  async exportExperimentData(@Param('id') id: string) {
    this.logger.log(`Exporting data for experiment: ${id}`);
    const csvData = await this.reportsService.exportExperimentData(id);
    return {
      filename: `experiment-${id}-data.csv`,
      data: csvData,
    };
  }

  @Post('experiments/:id/pause')
  @HttpCode(HttpStatus.OK)
  async pauseExperiment(@Param('id') id: string) {
    this.logger.log(`Pausing experiment: ${id}`);
    return await this.experimentService.pauseExperiment(id);
  }

  @Post('experiments/:id/resume')
  @HttpCode(HttpStatus.OK)
  async resumeExperiment(@Param('id') id: string) {
    this.logger.log(`Resuming experiment: ${id}`);
    return await this.experimentService.resumeExperiment(id);
  }

  @Post('experiments/:id/archive')
  @HttpCode(HttpStatus.OK)
  async archiveExperiment(@Param('id') id: string) {
    this.logger.log(`Archiving experiment: ${id}`);
    return await this.experimentService.archiveExperiment(id);
  }

  @Get('experiments/:id/assign-user/:userId')
  async assignUserToVariant(
    @Param('id') experimentId: string,
    @Param('userId') userId: string
  ) {
    this.logger.log(`Assigning user ${userId} to variant for experiment: ${experimentId}`);
    return await this.abTestingService.assignUserToVariant(experimentId, userId);
  }
}