import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import type { EnrollmentsService } from './enrollments.service';
import type { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import type { UpdateEnrollmentDto } from './dto/update-enrollment.dto';

@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post()
  create(@Body() createEnrollmentDto: CreateEnrollmentDto) {
    return this.enrollmentsService.create(createEnrollmentDto);
  }

  @Get()
  findAll(
    @Query('courseId') courseId?: string,
    @Query('userId') userId?: string,
  ) {
    return this.enrollmentsService.findAll(courseId, userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.enrollmentsService.findOne(id);
  }

  @Get('user/:userId/course/:courseId')
  findByUserAndCourse(
    @Param('userId') userId: string,
    @Param('courseId') courseId: string,
  ) {
    return this.enrollmentsService.findByUserAndCourse(userId, courseId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateEnrollmentDto: UpdateEnrollmentDto,
  ) {
    return this.enrollmentsService.update(id, updateEnrollmentDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.enrollmentsService.remove(id);
  }

  @Post(':id/progress/:lessonId')
  updateProgress(
    @Param('id') id: string,
    @Param('lessonId') lessonId: string,
    @Body() body: { completed: boolean },
  ) {
    return this.enrollmentsService.updateProgress(id, lessonId, body.completed);
  }
}
