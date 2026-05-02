import { Controller, Post, Body } from '@nestjs/common';
import { LearningPathsService } from './learning-paths.service';

/**
 * Exposes learning Paths endpoints.
 */
@Controller('learning-paths')
export class LearningPathsController {
  constructor(private readonly learningPathsService: LearningPathsService) {}

  /**
   * Generates learning Path.
   * @param payload The payload to process.
   * @returns The operation result.
   */
  @Post('generate')
  generateLearningPath(@Body() payload: any) {
    return this.learningPathsService.generateLearningPath(payload);
  }
}
