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
import { EnrollmentsService } from './enrollments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';
import { BulkEnrollmentDto } from './dto/bulk-enrollment.dto';

@ApiTags('enrollments')
@Controller('enrollments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post('bulk')
  @Throttle({ default: { limit: 1, ttl: 60000 } })
  @ApiOperation({ summary: 'Bulk enroll users into courses' })
  @ApiResponse({ status: 201, description: 'Bulk enrollment processed' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  async bulkEnroll(@Body() bulkDto: BulkEnrollmentDto) {
    return this.enrollmentsService.bulkEnroll(bulkDto.enrollments);
  }

  @Post(':courseId')
  @ApiOperation({ summary: 'Enroll in a course' })
  @ApiResponse({ status: 201, description: 'Successfully enrolled in course' })
  @ApiResponse({ status: 400, description: 'Prerequisite not met or already enrolled' })
  @ApiResponse({ status: 404, description: 'Course not found' })
  async enroll(@Param('courseId') courseId: string, @Request() req) {
    return this.enrollmentsService.enroll(req.user.id, courseId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all enrollments for current user' })
  @ApiResponse({ status: 200, description: 'Returns user enrollments' })
  async getUserEnrollments(@Request() req) {
    return this.enrollmentsService.getUserEnrollments(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific enrollment by ID' })
  @ApiResponse({ status: 200, description: 'Returns enrollment details' })
  @ApiResponse({ status: 404, description: 'Enrollment not found' })
  async findOne(@Param('id') id: string, @Request() req) {
    return this.enrollmentsService.findOne(id, req.user.id);
  }

  @Put(':id/progress')
  @ApiOperation({ summary: 'Update enrollment progress' })
  @ApiResponse({ status: 200, description: 'Progress updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid progress value' })
  async updateProgress(
    @Param('id') id: string,
    @Body('progress') progress: number,
    @Request() req,
  ) {
    return this.enrollmentsService.updateProgress(id, progress, req.user.id);
  }

  @Delete(':courseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unenroll from a course' })
  @ApiResponse({ status: 204, description: 'Successfully unenrolled' })
  @ApiResponse({ status: 404, description: 'Enrollment not found' })
  async unenroll(@Param('courseId') courseId: string, @Request() req) {
    return this.enrollmentsService.unenroll(req.user.id, courseId);
  }

  @Get('course/:courseId')
  @ApiOperation({ summary: 'Get all enrollments for a specific course (instructor/admin only)' })
  @ApiResponse({ status: 200, description: 'Returns course enrollments' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getCourseEnrollments(@Param('courseId') courseId: string, @Request() req) {
    return this.enrollmentsService.getCourseEnrollments(courseId, req.user);
  }
}
