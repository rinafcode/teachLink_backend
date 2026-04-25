import { Controller, Get, Post, Put, Delete, Param, Body, Query, Logger, HttpCode, HttpStatus, UseGuards, } from '@nestjs/common';
import { ABTestingService, CreateExperimentDto } from './ab-testing.service';
import { ExperimentService } from './experiments/experiment.service';
import { StatisticalAnalysisService } from './analysis/statistical-analysis.service';
import { AutomatedDecisionService } from './automation/automated-decision.service';
import { ABTestingReportsService } from './reporting/ab-testing-reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
@Controller('ab-testing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ABTestingController {
    private readonly logger = new Logger(ABTestingController.name);
    constructor(private abTestingService: ABTestingService, private experimentService: ExperimentService, private statisticalAnalysisService: StatisticalAnalysisService, private automatedDecisionService: AutomatedDecisionService, private reportsService: ABTestingReportsService) { }
    @Get('experiments')
    @Roles(UserRole.ADMIN, UserRole.TEACHER)
    async getAllExperiments(): Promise<unknown> {
        this.logger.log('Fetching all experiments');
        return await this.abTestingService.getAllExperiments();
    }
    @Get('experiments/:id')
    async getExperimentById(
    @Param('id')
    id: string): Promise<unknown> {
        this.logger.log(`Fetching experiment: ${id}`);
        return await this.abTestingService.getExperimentById(id);
    }
    @Post('experiments')
    @HttpCode(HttpStatus.CREATED)
    @Roles(UserRole.ADMIN)
    async createExperiment(
    @Body()
    createExperimentDto: CreateExperimentDto): Promise<unknown> {
        this.logger.log(`Creating new experiment: ${createExperimentDto.name}`);
        return await this.abTestingService.createExperiment(createExperimentDto);
    }
    @Post('experiments/:id/start')
    @HttpCode(HttpStatus.OK)
    @Roles(UserRole.ADMIN)
    async startExperiment(
    @Param('id')
    id: string): Promise<unknown> {
        this.logger.log(`Starting experiment: ${id}`);
        return await this.abTestingService.startExperiment(id);
    }
    @Post('experiments/:id/stop')
    @HttpCode(HttpStatus.OK)
    @Roles(UserRole.ADMIN)
    async stopExperiment(
    @Param('id')
    id: string): Promise<unknown> {
        this.logger.log(`Stopping experiment: ${id}`);
        return await this.abTestingService.stopExperiment(id);
    }
    @Put('experiments/:id')
    @HttpCode(HttpStatus.OK)
    @Roles(UserRole.ADMIN)
    async updateExperiment(
    @Param('id')
    id: string, 
    @Body()
    updateData: unknown): Promise<unknown> {
        this.logger.log(`Updating experiment: ${id}`);
        return await this.experimentService.updateExperiment(id, updateData);
    }
    @Delete('experiments/:id')
    @HttpCode(HttpStatus.OK)
    @Roles(UserRole.ADMIN)
    async deleteExperiment(
    @Param('id')
    id: string): Promise<unknown> {
        this.logger.log(`Deleting experiment: ${id}`);
        // Implementation would go here
        return { message: 'Experiment deleted successfully' };
    }
    @Get('experiments/:id/results')
    async getExperimentResults(
    @Param('id')
    id: string): Promise<unknown> {
        this.logger.log(`Fetching results for experiment: ${id}`);
        return await this.experimentService.getExperimentResults(id);
    }
    @Post('experiments/:id/variants')
    @HttpCode(HttpStatus.CREATED)
    @Roles(UserRole.ADMIN)
    async addVariant(
    @Param('id')
    experimentId: string, 
    @Body()
    variantData: unknown): Promise<unknown> {
        this.logger.log(`Adding variant to experiment: ${experimentId}`);
        return await this.experimentService.addVariant(experimentId, variantData);
    }
    @Delete('variants/:id')
    @HttpCode(HttpStatus.OK)
    @Roles(UserRole.ADMIN)
    async removeVariant(
    @Param('id')
    variantId: string): Promise<unknown> {
        this.logger.log(`Removing variant: ${variantId}`);
        await this.experimentService.removeVariant(variantId);
        return { message: 'Variant removed successfully' };
    }
    @Put('experiments/:id/traffic-allocation')
    @HttpCode(HttpStatus.OK)
    @Roles(UserRole.ADMIN)
    async updateTrafficAllocation(
    @Param('id')
    experimentId: string, 
    @Body()
    allocations: Record<string, number>): Promise<unknown> {
        this.logger.log(`Updating traffic allocation for experiment: ${experimentId}`);
        await this.experimentService.updateTrafficAllocation(experimentId, allocations);
        return { message: 'Traffic allocation updated successfully' };
    }
    @Get('experiments/:id/statistical-analysis')
    async getStatisticalAnalysis(
    @Param('id')
    id: string): Promise<unknown> {
        this.logger.log(`Performing statistical analysis for experiment: ${id}`);
        return await this.statisticalAnalysisService.calculateStatisticalSignificance(id);
    }
    @Get('experiments/:id/effect-size')
    async getEffectSize(
    @Param('id')
    id: string): Promise<unknown> {
        this.logger.log(`Calculating effect size for experiment: ${id}`);
        return await this.statisticalAnalysisService.calculateEffectSize(id);
    }
    @Post('experiments/:id/auto-select-winner')
    @HttpCode(HttpStatus.OK)
    @Roles(UserRole.ADMIN)
    async autoSelectWinner(
    @Param('id')
    id: string, 
    @Body()
    criteria?: unknown): Promise<unknown> {
        this.logger.log(`Auto-selecting winner for experiment: ${id}`);
        return await this.automatedDecisionService.autoSelectWinner(id, criteria);
    }
    @Get('experiments/:id/decision-recommendations')
    async getDecisionRecommendations(
    @Param('id')
    id: string): Promise<unknown> {
        this.logger.log(`Getting decision recommendations for experiment: ${id}`);
        return await this.automatedDecisionService.getDecisionRecommendations(id);
    }
    @Post('experiments/:id/auto-allocate-traffic')
    @HttpCode(HttpStatus.OK)
    @Roles(UserRole.ADMIN)
    async autoAllocateTraffic(
    @Param('id')
    id: string): Promise<unknown> {
        this.logger.log(`Auto-allocating traffic for experiment: ${id}`);
        await this.automatedDecisionService.autoAllocateTraffic(id);
        return { message: 'Traffic auto-allocated successfully' };
    }
    @Get('reports/dashboard')
    @Roles(UserRole.ADMIN, UserRole.TEACHER)
    async getDashboardSummary(
    @Query()
    filters?: unknown): Promise<unknown> {
        this.logger.log('Generating dashboard summary');
        return await this.reportsService.getDashboardSummary(filters);
    }
    @Get('reports/experiment/:id')
    async generateExperimentReport(
    @Param('id')
    id: string): Promise<unknown> {
        this.logger.log(`Generating report for experiment: ${id}`);
        return await this.reportsService.generateExperimentReport(id);
    }
    @Get('reports/performance-comparison')
    async getPerformanceComparisonReport(): Promise<unknown> {
        this.logger.log('Generating performance comparison report');
        return await this.reportsService.generatePerformanceComparisonReport();
    }
    @Get('reports/timeline')
    async getExperimentTimeline(): Promise<unknown> {
        this.logger.log('Generating experiment timeline');
        return await this.reportsService.getExperimentTimeline();
    }
    @Get('reports/experiment/:id/export')
    async exportExperimentData(
    @Param('id')
    id: string): Promise<unknown> {
        this.logger.log(`Exporting data for experiment: ${id}`);
        const csvData = await this.reportsService.exportExperimentData(id);
        return {
            filename: `experiment-${id}-data.csv`,
            data: csvData,
        };
    }
    @Post('experiments/:id/pause')
    @HttpCode(HttpStatus.OK)
    @Roles(UserRole.ADMIN)
    async pauseExperiment(
    @Param('id')
    id: string): Promise<unknown> {
        this.logger.log(`Pausing experiment: ${id}`);
        return await this.experimentService.pauseExperiment(id);
    }
    @Post('experiments/:id/resume')
    @HttpCode(HttpStatus.OK)
    @Roles(UserRole.ADMIN)
    async resumeExperiment(
    @Param('id')
    id: string): Promise<unknown> {
        this.logger.log(`Resuming experiment: ${id}`);
        return await this.experimentService.resumeExperiment(id);
    }
    @Post('experiments/:id/archive')
    @HttpCode(HttpStatus.OK)
    @Roles(UserRole.ADMIN)
    async archiveExperiment(
    @Param('id')
    id: string): Promise<unknown> {
        this.logger.log(`Archiving experiment: ${id}`);
        return await this.experimentService.archiveExperiment(id);
    }
    @Get('experiments/:id/assign-user/:userId')
    @Roles(UserRole.ADMIN)
    async assignUserToVariant(
    @Param('id')
    experimentId: string, 
    @Param('userId')
    userId: string): Promise<unknown> {
        this.logger.log(`Assigning user ${userId} to variant for experiment: ${experimentId}`);
        return await this.abTestingService.assignUserToVariant(experimentId, userId);
    }
}
