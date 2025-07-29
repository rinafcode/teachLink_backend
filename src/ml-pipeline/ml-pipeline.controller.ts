import { Controller, Post, Body } from '@nestjs/common';
import { MLPipelineOrchestratorService } from './ml-pipeline-orchestrator.service';

@Controller('ml-pipeline')
export class MLPipelineController {
  constructor(private readonly orchestrator: MLPipelineOrchestratorService) {}

  @Post('run')
  async runPipeline(@Body() body: { trainingData: any; testData: any }) {
    return this.orchestrator.runFullPipeline(body.trainingData, body.testData);
  }
} 