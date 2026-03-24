import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CourseSearchDto } from './dto/course-search.dto';
import { ModulesService } from './modules/modules.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { LessonsService } from './lessons/lessons.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { EnrollmentsService } from './enrollments/enrollments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('courses')
export class CoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly modulesService: ModulesService,
    private readonly lessonsService: LessonsService,
    private readonly enrollmentsService: EnrollmentsService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Request() req, @Body() createCourseDto: CreateCourseDto) {
    // Get user from JWT token
    const user = req.user;
    if (!user || !user.id) {
      throw new Error('User not authenticated');
    }
    return this.coursesService.create({
      ...createCourseDto,
      instructorId: user.id,
    });
  }

  @Get()
  findAll(@Query() searchDto: CourseSearchDto) {
    return this.coursesService.findAll(searchDto);
  }

  @Get('analytics')
  @UseGuards(JwtAuthGuard)
  getAnalytics(@Request() _req) {
    return this.coursesService.getAnalytics();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.coursesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() updateCourseDto: UpdateCourseDto) {
    return this.coursesService.update(id, updateCourseDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.coursesService.remove(id);
  }

  // Modules
  @Post(':id/modules')
  @UseGuards(JwtAuthGuard)
  createModule(
    @Request() req,
    @Param('id') courseId: string,
    @Body() createModuleDto: CreateModuleDto,
  ) {
    createModuleDto.courseId = courseId;
    return this.modulesService.create(createModuleDto);
  }

  // Lessons
  @Post('modules/:moduleId/lessons')
  @UseGuards(JwtAuthGuard)
  createLesson(
    @Request() req,
    @Param('moduleId') moduleId: string,
    @Body() createLessonDto: CreateLessonDto,
  ) {
    createLessonDto.moduleId = moduleId;
    return this.lessonsService.create(createLessonDto);
  }

  // Enrollments
  @Post(':id/enroll')
  @UseGuards(JwtAuthGuard)
  enroll(@Request() req, @Param('id') courseId: string) {
    const userId = req.user.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
    return this.enrollmentsService.enroll(userId, courseId);
  }
}
