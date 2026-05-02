import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request, } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CourseSearchDto, CursorCourseSearchDto } from './dto/course-search.dto';
import { ModulesService } from './modules/modules.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { LessonsService } from './lessons/lessons.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { EnrollmentsService } from './enrollments/enrollments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Exposes courses endpoints.
 */
@Controller('courses')
export class CoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly modulesService: ModulesService,
    private readonly lessonsService: LessonsService,
    private readonly enrollmentsService: EnrollmentsService,
  ) {}

  /**
   * Creates a new record.
   * @param req The req.
   * @param createCourseDto The request payload.
   * @returns The operation result.
   */
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

  /**
   * Returns all.
   * @param searchDto The request payload.
   * @returns The operation result.
   */
  @Get()
  findAll(@Query() searchDto: CourseSearchDto) {
    return this.coursesService.findAll(searchDto);
  }

  /**
   * Returns all With Cursor.
   * @param searchDto The request payload.
   * @returns The operation result.
   */
  @Get('cursor')
  findAllWithCursor(@Query() searchDto: CursorCourseSearchDto) {
    return this.coursesService.findAllWithCursor(searchDto);
  }

  /**
   * Returns analytics.
   * @param _req The req.
   * @returns The operation result.
   */
  @Get('analytics')
  @UseGuards(JwtAuthGuard)
  getAnalytics(@Request() _req) {
    return this.coursesService.getAnalytics();
  }

  /**
   * Returns one.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.coursesService.findOne(id);
  }

  /**
   * Updates the requested record.
   * @param id The identifier.
   * @param updateCourseDto The request payload.
   * @returns The operation result.
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() updateCourseDto: UpdateCourseDto) {
    return this.coursesService.update(id, updateCourseDto);
  }

  /**
   * Removes the requested record.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.coursesService.remove(id);
  }

  // Modules
  /**
   * Creates module.
   * @param req The req.
   * @param courseId The course identifier.
   * @param createModuleDto The request payload.
   * @returns The operation result.
   */
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
  /**
   * Creates lesson.
   * @param req The req.
   * @param moduleId The module identifier.
   * @param createLessonDto The request payload.
   * @returns The operation result.
   */
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
  /**
   * Executes enroll.
   * @param req The req.
   * @param courseId The course identifier.
   * @returns The operation result.
   */
  @Post(':id/enroll')
  @UseGuards(JwtAuthGuard)
  enroll(@Request() req, @Param('id') courseId: string) {
    const userId = req.user.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }
}
