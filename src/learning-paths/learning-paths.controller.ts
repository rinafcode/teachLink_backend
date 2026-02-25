import { Controller, Post, Body } from '@nestjs/common';
import { LearningPathsService } from './learning-paths.service';

@Controller('learning-paths')
export class LearningPathsController {
  constructor(
    private readonly learningPathsService: LearningPathsService,
  ) {}

  @Post('generate')
  generateLearningPath(@Body() payload: any) {
    return this.learningPathsService.generateLearningPath(payload);
  }
}
