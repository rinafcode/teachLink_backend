import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { LearningPathsService } from './learning-paths.service';
import { CreateLearningPathDto } from './dto/create-learning-path.dto';

@Controller('learning-paths')
export class LearningPathsController {
  constructor(private readonly learningPathsService: LearningPathsService) {}

  @Post()
  createLearningPath(@Body() dto: CreateLearningPathDto) {
    return this.learningPathsService.createPath(dto);
  }

  @Get(':userId')
  getLearningPath(@Param('userId') userId: string) {
    return this.learningPathsService.getPathForUser(userId);
  }
}
