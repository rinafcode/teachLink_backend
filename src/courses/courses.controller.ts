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
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CourseSearchDto } from './dto/course-search.dto';
import { ModulesService } from './modules/modules.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { LessonsService } from './lessons/lessons.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { EnrollmentsService } from './enrollments/enrollments.service';

@Controller('courses')
export class CoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly modulesService: ModulesService,
    private readonly lessonsService: LessonsService,
    private readonly enrollmentsService: EnrollmentsService,
  ) {}

  @Post()
  create(@Body() createCourseDto: CreateCourseDto) {
    // In a real app, user comes from req.user (JWT)
    // For now, we'll assume a user is passed or we create a dummy one in service if needed
    // But service expects User entity.
    // We'll mock it here for simplicity of the API implementation task
    const user = { id: '00000000-0000-0000-0000-000000000000' } as any;
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
  getAnalytics() {
    return this.coursesService.getAnalytics();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.coursesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCourseDto: UpdateCourseDto) {
    return this.coursesService.update(id, updateCourseDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.coursesService.remove(id);
  }

  // Modules
  @Post(':id/modules')
  createModule(
    @Param('id') courseId: string,
    @Body() createModuleDto: CreateModuleDto,
  ) {
    createModuleDto.courseId = courseId;
    return this.modulesService.create(createModuleDto);
  }

  // Lessons
  @Post('modules/:moduleId/lessons')
  createLesson(
    @Param('moduleId') moduleId: string,
    @Body() createLessonDto: CreateLessonDto,
  ) {
    createLessonDto.moduleId = moduleId;
    return this.lessonsService.create(createLessonDto);
  }

  // Enrollments
  @Post(':id/enroll')
  enroll(@Param('id') courseId: string) {
    const userId = '00000000-0000-0000-0000-000000000000'; // Placeholder
    return this.enrollmentsService.enroll(userId, courseId);
  }
}
