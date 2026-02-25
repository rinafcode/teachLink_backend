import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ETLPipelineService } from './etl/etl-pipeline.service';
import { DimensionalModelingService } from './modeling/dimensional-modeling.service';
import { DataQualityService } from './quality/data-quality.service';
import { DataLineageService } from './lineage/data-lineage.service';
import { IncrementalLoaderService } from './loading/incremental-loader.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('data-warehouse')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DataWarehouseController {
  constructor(
    private readonly etlService: ETLPipelineService,
    private readonly modelingService: DimensionalModelingService,
    private readonly qualityService: DataQualityService,
    private readonly lineageService: DataLineageService,
    private readonly loaderService: IncrementalLoaderService,
  ) {}

  // ETL Pipeline endpoints
  @Post('etl/pipeline')
  async createETLPipeline(@Body() config: any, @Request() req) {
    const pipeline = await this.etlService.createPipeline(config);
    return { success: true, pipeline };
  }

  @Get('etl/pipeline/:id')
  async getETLPipeline(@Param('id') id: string) {
    const pipeline = await this.etlService.getJobStatus(id);
    return { success: true, pipeline };
  }

  @Get('etl/pipelines')
  async getAllETLPipelines() {
    const pipelines = await this.etlService.getAllJobs();
    return { success: true, pipelines };
  }

  // Dimensional Modeling endpoints
  @Post('modeling/star-schema')
  async createStarSchema(@Body() body: { name: string; factTable: any; dimensionTables: any[] }) {
    const model = await this.modelingService.createStarSchema(
      body.name,
      body.factTable,
      body.dimensionTables
    );
    return { success: true, model };
  }

  @Post('modeling/snowflake-schema')
  async createSnowflakeSchema(@Body() body: { name: string; factTable: any; dimensionTables: any[]; subDimensions: any }) {
    const model = await this.modelingService.createSnowflakeSchema(
      body.name,
      body.factTable,
      body.dimensionTables,
      body.subDimensions
    );
    return { success: true, model };
  }

  @Get('modeling/models')
  async getAllModels() {
    const models = await this.modelingService.getAllModels();
    return { success: true, models };
  }

  @Get('modeling/model/:id')
  async getModel(@Param('id') id: string) {
    const model = await this.modelingService.getModel(id);
    return { success: true, model };
  }

  @Post('modeling/query')
  async createQuery(@Body() queryConfig: any) {
    const query = await this.modelingService.createQuery(queryConfig);
    return { success: true, query };
  }

  @Post('modeling/query/:id/execute')
  async executeQuery(
    @Param('id') id: string,
    @Body() body: { parameters?: any }
  ) {
    const results = await this.modelingService.executeQuery(id, body.parameters);
    return { success: true, results };
  }

  // Data Quality endpoints
  @Post('quality/profile')
  async createQualityProfile(@Body() profileConfig: any) {
    const profile = await this.qualityService.createProfile(profileConfig);
    return { success: true, profile };
  }

  @Post('quality/profiles/standard')
  async createStandardProfiles() {
    const profiles = await this.qualityService.createStandardProfiles();
    return { success: true, profiles };
  }

  @Post('quality/check/:profileId')
  async runQualityCheck(
    @Param('profileId') profileId: string,
    @Body() body: { data: any[] }
  ) {
    const check = await this.qualityService.runQualityChecks(profileId, body.data);
    return { success: true, check };
  }

  @Get('quality/checks/:profileId')
  async getQualityChecks(@Param('profileId') profileId: string) {
    const checks = await this.qualityService.getChecksForProfile(profileId);
    return { success: true, checks };
  }

  @Get('quality/issues')
  async getQualityIssues(
    @Query('profileId') profileId?: string,
    @Query('severity') severity?: string,
    @Query('resolved') resolved?: string
  ) {
    const resolvedBool = resolved === 'true' ? true : resolved === 'false' ? false : undefined;
    const issues = await this.qualityService.getQualityIssues(profileId, severity, resolvedBool);
    return { success: true, issues };
  }

  // Data Lineage endpoints
  @Post('lineage/graph')
  async createLineageGraph(@Body() graphConfig: any) {
    const graph = await this.lineageService.createGraph(graphConfig);
    return { success: true, graph };
  }

  @Post('lineage/graphs/standard')
  async createStandardLineage() {
    const graph = await this.lineageService.createStandardLineage();
    return { success: true, graph };
  }

  @Get('lineage/graphs')
  async getAllLineageGraphs() {
    const graphs = await this.lineageService.getAllGraphs();
    return { success: true, graphs };
  }

  @Post('lineage/graph/:id/node')
  async addLineageNode(@Param('id') graphId: string, @Body() nodeConfig: any) {
    const node = await this.lineageService.addNode(graphId, nodeConfig);
    return { success: true, node };
  }

  @Post('lineage/graph/:id/edge')
  async addLineageEdge(@Param('id') graphId: string, @Body() edgeConfig: any) {
    const edge = await this.lineageService.addEdge(graphId, edgeConfig);
    return { success: true, edge };
  }

  @Post('lineage/graph/:id/trace/:nodeId')
  async traceLineage(
    @Param('id') graphId: string,
    @Param('nodeId') nodeId: string,
    @Body() body: { traceType?: 'upstream' | 'downstream' | 'complete' }
  ) {
    const traceType = body.traceType || 'complete';
    const trace = await this.lineageService.traceLineage(graphId, nodeId, traceType);
    return { success: true, trace };
  }

  @Post('lineage/graph/:id/impact/:nodeId')
  async analyzeImpact(@Param('id') graphId: string, @Param('nodeId') nodeId: string) {
    const analysis = await this.lineageService.analyzeImpact(graphId, nodeId);
    return { success: true, analysis };
  }

  // Incremental Loading endpoints
  @Post('loading/job')
  async createLoadJob(@Body() body: { config: any; source: any; target: any }) {
    const job = await this.loaderService.createLoadJob(body.config, body.source, body.target);
    return { success: true, job };
  }

  @Post('loading/job/:id/execute')
  async executeLoadJob(@Param('id') jobId: string, @Body() body: { sourceTable: string; targetTable: string }) {
    const job = await this.loaderService.executeLoad(jobId, body.sourceTable, body.targetTable);
    return { success: true, job };
  }

  @Get('loading/jobs')
  async getAllLoadJobs() {
    const jobs = await this.loaderService.getAllJobs();
    return { success: true, jobs };
  }

  @Get('loading/job/:id')
  async getLoadJob(@Param('id') id: string) {
    const job = await this.loaderService.getJobStatus(id);
    return { success: true, job };
  }

  @Post('loading/watermark')
  async setWatermark(@Body() body: { tableName: string; columnName: string; value: any }) {
    const watermark = await this.loaderService.setWatermark(
      body.tableName,
      body.columnName,
      body.value
    );
    return { success: true, watermark };
  }

  @Get('loading/watermark/:tableName/:columnName')
  async getWatermark(@Param('tableName') tableName: string, @Param('columnName') columnName: string) {
    const watermark = await this.loaderService.getWatermark(tableName, columnName);
    return { success: true, watermark };
  }
}