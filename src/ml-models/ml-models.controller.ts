import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { MLModelsService } from './ml-models.service';
import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';
import { TrainModelDto } from './dto/train-model.dto';
import { DeployModelDto } from './dto/deploy-model.dto';
import { CreateABTestDto } from './dto/create-ab-test.dto';
import { MLModel } from './entities/ml-model.entity';
import { ModelVersion } from './entities/model-version.entity';
import { ModelDeployment } from './entities/model-deployment.entity';
import { ABTest } from './entities/ab-test.entity';
import { ModelStatus, ModelType, ModelFramework, VersionStatus, DeploymentStatus, DeploymentEnvironment, ABTestStatus, ABTestType } from './enums';

@ApiTags('ML Models')
@Controller('ml-models')
export class MLModelsController {
  constructor(private readonly mlModelsService: MLModelsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new ML model' })
  @ApiResponse({ status: 201, description: 'Model created successfully', type: MLModel })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createModel(@Body() createModelDto: CreateModelDto): Promise<MLModel> {
    return await this.mlModelsService.createModel(createModelDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all ML models with pagination and filtering' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiQuery({ name: 'status', required: false, enum: ['draft', 'training', 'trained', 'deployed', 'archived', 'failed'] })
  @ApiQuery({ name: 'type', required: false, enum: ['classification', 'regression', 'clustering', 'recommendation', 'nlp', 'computer_vision', 'reinforcement_learning'] })
  @ApiQuery({ name: 'framework', required: false, enum: ['tensorflow', 'pytorch', 'scikit-learn', 'xgboost', 'lightgbm', 'custom'] })
  @ApiResponse({ status: 200, description: 'Models retrieved successfully' })
  async getAllModels(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('framework') framework?: string,
  ) {
    return await this.mlModelsService.findAllModels(page, limit, status, type, framework);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific ML model by ID' })
  @ApiParam({ name: 'id', description: 'Model ID' })
  @ApiResponse({ status: 200, description: 'Model retrieved successfully', type: MLModel })
  @ApiResponse({ status: 404, description: 'Model not found' })
  async getModel(@Param('id') id: string): Promise<MLModel> {
    return await this.mlModelsService.findModelById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an ML model' })
  @ApiParam({ name: 'id', description: 'Model ID' })
  @ApiResponse({ status: 200, description: 'Model updated successfully', type: MLModel })
  @ApiResponse({ status: 404, description: 'Model not found' })
  async updateModel(
    @Param('id') id: string,
    @Body() updateModelDto: UpdateModelDto,
  ): Promise<MLModel> {
    return await this.mlModelsService.updateModel(id, updateModelDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an ML model' })
  @ApiParam({ name: 'id', description: 'Model ID' })
  @ApiResponse({ status: 204, description: 'Model deleted successfully' })
  @ApiResponse({ status: 404, description: 'Model not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete model with active deployments' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteModel(@Param('id') id: string): Promise<void> {
    await this.mlModelsService.deleteModel(id);
  }

  @Post(':id/train')
  @ApiOperation({ summary: 'Train an ML model' })
  @ApiParam({ name: 'id', description: 'Model ID' })
  @ApiResponse({ status: 201, description: 'Model training started successfully', type: ModelVersion })
  @ApiResponse({ status: 404, description: 'Model not found' })
  @ApiResponse({ status: 400, description: 'Training failed' })
  async trainModel(
    @Param('id') id: string,
    @Body() trainModelDto: TrainModelDto,
  ): Promise<ModelVersion> {
    trainModelDto.modelId = id;
    return await this.mlModelsService.trainModel(trainModelDto);
  }

  @Post(':id/deploy')
  @ApiOperation({ summary: 'Deploy an ML model' })
  @ApiParam({ name: 'id', description: 'Model ID' })
  @ApiResponse({ status: 201, description: 'Model deployed successfully', type: ModelDeployment })
  @ApiResponse({ status: 404, description: 'Model or version not found' })
  @ApiResponse({ status: 400, description: 'Deployment failed' })
  async deployModel(
    @Param('id') id: string,
    @Body() deployModelDto: DeployModelDto,
  ): Promise<ModelDeployment> {
    deployModelDto.modelId = id;
    return await this.mlModelsService.deployModel(deployModelDto);
  }

  @Post('deployments/:deploymentId/rollback/:rollbackDeploymentId')
  @ApiOperation({ summary: 'Rollback a deployment to a previous version' })
  @ApiParam({ name: 'deploymentId', description: 'Current deployment ID' })
  @ApiParam({ name: 'rollbackDeploymentId', description: 'Rollback deployment ID' })
  @ApiResponse({ status: 200, description: 'Rollback completed successfully', type: ModelDeployment })
  @ApiResponse({ status: 404, description: 'Deployment not found' })
  @ApiResponse({ status: 400, description: 'Rollback failed' })
  async rollbackDeployment(
    @Param('deploymentId') deploymentId: string,
    @Param('rollbackDeploymentId') rollbackDeploymentId: string,
  ): Promise<ModelDeployment> {
    return await this.mlModelsService.rollbackDeployment(deploymentId, rollbackDeploymentId);
  }

  @Get(':id/performance')
  @ApiOperation({ summary: 'Get model performance metrics' })
  @ApiParam({ name: 'id', description: 'Model ID' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Number of days to look back' })
  @ApiResponse({ status: 200, description: 'Performance metrics retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Model not found' })
  async getModelPerformance(
    @Param('id') id: string,
    @Query('days') days: number = 30,
  ) {
    return await this.mlModelsService.getModelPerformance(id, days);
  }

  @Get(':id/lineage')
  @ApiOperation({ summary: 'Get model lineage and version history' })
  @ApiParam({ name: 'id', description: 'Model ID' })
  @ApiResponse({ status: 200, description: 'Model lineage retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Model not found' })
  async getModelLineage(@Param('id') id: string) {
    return await this.mlModelsService.getModelLineage(id);
  }

  @Post('ab-tests')
  @ApiOperation({ summary: 'Create a new A/B test' })
  @ApiResponse({ status: 201, description: 'A/B test created successfully', type: ABTest })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createABTest(@Body() createABTestDto: CreateABTestDto): Promise<ABTest> {
    return await this.mlModelsService.createABTest(createABTestDto);
  }

  @Post('ab-tests/:id/start')
  @ApiOperation({ summary: 'Start an A/B test' })
  @ApiParam({ name: 'id', description: 'A/B test ID' })
  @ApiResponse({ status: 200, description: 'A/B test started successfully', type: ABTest })
  @ApiResponse({ status: 404, description: 'A/B test not found' })
  @ApiResponse({ status: 400, description: 'Cannot start A/B test' })
  async startABTest(@Param('id') id: string): Promise<ABTest> {
    return await this.mlModelsService.startABTest(id);
  }

  @Post('ab-tests/:id/stop')
  @ApiOperation({ summary: 'Stop an A/B test' })
  @ApiParam({ name: 'id', description: 'A/B test ID' })
  @ApiResponse({ status: 200, description: 'A/B test stopped successfully', type: ABTest })
  @ApiResponse({ status: 404, description: 'A/B test not found' })
  @ApiResponse({ status: 400, description: 'Cannot stop A/B test' })
  async stopABTest(
    @Param('id') id: string,
    @Body() body: { stopReason: string },
  ): Promise<ABTest> {
    return await this.mlModelsService.stopABTest(id, body.stopReason);
  }

  @Get('ab-tests')
  @ApiOperation({ summary: 'Get all A/B tests' })
  @ApiResponse({ status: 200, description: 'A/B tests retrieved successfully' })
  async getAllABTests() {
    // This would be implemented in the service
    return { message: 'A/B tests endpoint' };
  }

  @Get('ab-tests/:id')
  @ApiOperation({ summary: 'Get a specific A/B test' })
  @ApiParam({ name: 'id', description: 'A/B test ID' })
  @ApiResponse({ status: 200, description: 'A/B test retrieved successfully', type: ABTest })
  @ApiResponse({ status: 404, description: 'A/B test not found' })
  async getABTest(@Param('id') id: string): Promise<ABTest> {
    // This would be implemented in the service
    return {} as ABTest;
  }

  @Post(':id/monitor')
  @ApiOperation({ summary: 'Monitor model performance and detect drift' })
  @ApiParam({ name: 'id', description: 'Model ID' })
  @ApiResponse({ status: 200, description: 'Monitoring results retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Model not found' })
  async monitorModel(@Param('id') id: string) {
    // This would be implemented in the service
    return { message: 'Model monitoring endpoint' };
  }

  @Post(':id/drift-detection')
  @ApiOperation({ summary: 'Detect model drift' })
  @ApiParam({ name: 'id', description: 'Model ID' })
  @ApiResponse({ status: 200, description: 'Drift detection completed successfully' })
  @ApiResponse({ status: 404, description: 'Model not found' })
  async detectDrift(
    @Param('id') id: string,
    @Body() body: { baselineData: any[]; currentData: any[] },
  ) {
    // This would be implemented in the service
    return { message: 'Drift detection endpoint' };
  }

  @Get('deployments')
  @ApiOperation({ summary: 'Get all model deployments' })
  @ApiQuery({ name: 'modelId', required: false, description: 'Filter by model ID' })
  @ApiQuery({ name: 'environment', required: false, enum: ['development', 'staging', 'production'] })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'deploying', 'active', 'failed', 'rolled_back', 'archived'] })
  @ApiResponse({ status: 200, description: 'Deployments retrieved successfully' })
  async getDeployments(
    @Query('modelId') modelId?: string,
    @Query('environment') environment?: string,
    @Query('status') status?: string,
  ) {
    // This would be implemented in the service
    return { message: 'Deployments endpoint' };
  }

  @Get('deployments/:id')
  @ApiOperation({ summary: 'Get a specific deployment' })
  @ApiParam({ name: 'id', description: 'Deployment ID' })
  @ApiResponse({ status: 200, description: 'Deployment retrieved successfully', type: ModelDeployment })
  @ApiResponse({ status: 404, description: 'Deployment not found' })
  async getDeployment(@Param('id') id: string): Promise<ModelDeployment> {
    // This would be implemented in the service
    return {} as ModelDeployment;
  }

  @Post('deployments/:id/scale')
  @ApiOperation({ summary: 'Scale a deployment' })
  @ApiParam({ name: 'id', description: 'Deployment ID' })
  @ApiResponse({ status: 200, description: 'Deployment scaled successfully', type: ModelDeployment })
  @ApiResponse({ status: 404, description: 'Deployment not found' })
  @ApiResponse({ status: 400, description: 'Scaling failed' })
  async scaleDeployment(
    @Param('id') id: string,
    @Body() body: { replicas: number },
  ): Promise<ModelDeployment> {
    // This would be implemented in the service
    return {} as ModelDeployment;
  }

  @Get('deployments/:id/health')
  @ApiOperation({ summary: 'Check deployment health' })
  @ApiParam({ name: 'id', description: 'Deployment ID' })
  @ApiResponse({ status: 200, description: 'Health check completed successfully' })
  @ApiResponse({ status: 404, description: 'Deployment not found' })
  async healthCheck(@Param('id') id: string) {
    // This would be implemented in the service
    return { message: 'Health check endpoint' };
  }

  @Get('deployments/:id/metrics')
  @ApiOperation({ summary: 'Get deployment metrics' })
  @ApiParam({ name: 'id', description: 'Deployment ID' })
  @ApiQuery({ name: 'timeRange', required: false, description: 'Time range for metrics' })
  @ApiResponse({ status: 200, description: 'Metrics retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Deployment not found' })
  async getDeploymentMetrics(
    @Param('id') id: string,
    @Query('timeRange') timeRange: string = '24h',
  ) {
    // This would be implemented in the service
    return { message: 'Deployment metrics endpoint' };
  }
} 