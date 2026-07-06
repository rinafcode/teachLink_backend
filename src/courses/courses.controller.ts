import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
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
import {
  BulkCategoryUpdateDto,
  BulkPriceUpdateDto,
  BulkPublishDto,
} from './dto/bulk-operations.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { PaginatedSwaggerDto } from '../common/dto/paginated-response.dto';
import { Course } from './entities/course.entity';

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
  @ApiOperation({ summary: 'Get all courses with pagination' })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated courses',
    type: PaginatedSwaggerDto(Course),
  })
  async findAll(@Request() req, @Query() query?: PaginationQueryDto) {
    return this.coursesService.findAll(req.user, query);
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

  // ─── BULK OPERATIONS ──────────────────────────────────────────────────────

  @Post('bulk/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bulk publish or unpublish courses',
    description:
      'Apply a publish/unpublish action to many courses owned by the caller in one request. ' +
      'Courses that are not found or not owned by the caller are skipped and reported in the snapshots.',
  })
  @ApiResponse({ status: 200, description: 'Bulk publish operation recorded' })
  async bulkPublish(@Body() dto: BulkPublishDto, @Request() req) {
    return this.coursesService.bulkPublish(dto, req.user);
  }

  @Post('bulk/price')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bulk update price across courses',
    description:
      'Apply a single new price value to many courses owned by the caller in one request.',
  })
  @ApiResponse({ status: 200, description: 'Bulk price update recorded' })
  async bulkUpdatePrice(@Body() dto: BulkPriceUpdateDto, @Request() req) {
    return this.coursesService.bulkUpdatePrice(dto, req.user);
  }

  @Post('bulk/category')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bulk update category across courses',
    description:
      'Apply a single new category value to many courses owned by the caller. ' +
      'Send `category: null` (or omit) to clear the category.',
  })
  @ApiResponse({ status: 200, description: 'Bulk category update recorded' })
  async bulkUpdateCategory(@Body() dto: BulkCategoryUpdateDto, @Request() req) {
    return this.coursesService.bulkUpdateCategory(dto, req.user);
  }

  @Get('bulk/operations')
  @ApiOperation({ summary: 'List recent bulk operations triggered by the current user' })
  @ApiResponse({ status: 200, description: 'Returns recent bulk operations' })
  async listBulkOperations(@Request() req, @Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : undefined;
    return this.coursesService.listBulkOperations(
      req.user,
      Number.isFinite(parsed) ? (parsed as number) : 50,
    );
  }

  @Post('bulk/operations/:id/undo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Undo a previously executed bulk operation',
    description:
      'Restores every successfully-modified course to its pre-operation state using the stored snapshot. ' +
      'Only the initiator or an admin/moderator may undo. An already-undone operation cannot be undone again.',
  })
  @ApiResponse({ status: 200, description: 'Bulk operation undone' })
  @ApiResponse({ status: 400, description: 'Operation already undone' })
  @ApiResponse({ status: 404, description: 'Bulk operation not found' })
  async undoBulkOperation(@Param('id') id: string, @Request() req) {
    return this.coursesService.undoBulkOperation(id, req.user);
  }
}
