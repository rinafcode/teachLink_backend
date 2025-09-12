import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import type { LessonsService } from './lessons.service';
import type { CreateLessonDto } from './dto/create-lesson.dto';
import type { UpdateLessonDto } from './dto/update-lesson.dto';

@Controller('courses/:courseId/modules/:moduleId/lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Post()
  create(
    @Param('moduleId') moduleId: string,
    @Body() createLessonDto: CreateLessonDto,
  ) {
    createLessonDto.moduleId = moduleId;
    return this.lessonsService.create(createLessonDto);
  }

  @Get()
  findAll(@Param('moduleId') moduleId: string) {
    return this.lessonsService.findAll(moduleId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.lessonsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateLessonDto: UpdateLessonDto) {
    return this.lessonsService.update(id, updateLessonDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.lessonsService.remove(id);
  }

  @Post('reorder')
  reorder(
    @Param('moduleId') moduleId: string,
    @Body() body: { lessonIds: string[] },
  ) {
    return this.lessonsService.reorder(moduleId, body.lessonIds);
  }
}
