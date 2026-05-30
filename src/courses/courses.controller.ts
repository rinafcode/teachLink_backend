import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { SubmitForReviewDto } from './dto/submit-for-review.dto';
import { ReviewCourseDto } from './dto/review-course.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('courses')
@Controller('courses')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new course' })
  @ApiResponse({ status: 201, description: 'Course created successfully' })
  async create(@Body() dto: CreateCourseDto, @Request() req) {
    return this.coursesService.create(dto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'Get all courses' })
  @ApiResponse({ status: 200, description: 'Returns all courses' })
  async findAll(@Request() req) {
    return this.coursesService.findAll(req.user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific course by ID' })
  @ApiResponse({ status: 200, description: 'Returns course details' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  async findOne(@Param('id') id: string) {
    return this.coursesService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a course' })
  @ApiResponse({ status: 200, description: 'Course updated successfully' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  async update(@Param('id') id: string, @Body() dto: UpdateCourseDto, @Request() req) {
    return this.coursesService.update(id, dto, req.user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a course' })
  @ApiResponse({ status: 204, description: 'Course deleted successfully' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  async remove(@Param('id') id: string, @Request() req) {
    return this.coursesService.remove(id, req.user);
  }

  @Post(':id/submit-for-review')
  @ApiOperation({ summary: 'Submit a course for review' })
  @ApiResponse({ status: 200, description: 'Course submitted for review' })
  async submitForReview(@Param('id') id: string, @Body() dto: SubmitForReviewDto, @Request() req) {
    return this.coursesService.submitForReview(id, dto, req.user);
  }

  @Post(':id/review')
  @ApiOperation({ summary: 'Review a course (admin/moderator only)' })
  @ApiResponse({ status: 200, description: 'Course reviewed successfully' })
  async reviewCourse(@Param('id') id: string, @Body() dto: ReviewCourseDto, @Request() req) {
    return this.coursesService.reviewCourse(id, dto, req.user);
  }

  @Get(':id/review-history')
  @ApiOperation({ summary: 'Get review history for a course' })
  @ApiResponse({ status: 200, description: 'Returns review history' })
  async getReviewHistory(@Param('id') id: string) {
    return this.coursesService.getReviewHistory(id);
  }

  @Get('pending/pending-queue')
  @ApiOperation({ summary: 'Get pending review queue (admin/moderator only)' })
  @ApiResponse({ status: 200, description: 'Returns pending courses' })
  async getPendingQueue(@Request() req) {
    return this.coursesService.getPendingQueue(req.user);
  }
}
