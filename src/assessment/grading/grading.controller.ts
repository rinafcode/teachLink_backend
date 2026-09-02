import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RubricsService } from './rubrics.service';
import { GradingService } from './grading.service';
import { FeedbackTemplatesService } from './feedback-templates.service';
import { Rubric } from './entities/rubric.entity';
import { SubmissionGrade } from './entities/submission-grade.entity';
import { FeedbackTemplate } from './entities/feedback-template.entity';
import { CreateRubricDto, UpdateRubricDto } from './dto/rubric.dto';
import {
  AutoGradeSubmissionDto,
  CreateFeedbackTemplateDto,
  GradeSubmissionDto,
  UpdateFeedbackTemplateDto,
} from './dto/grading.dto';

/**
 * Exposes endpoints for the rubric-based grading system:
 *  - Rubric creation & lookup
 *  - Manual rubric scoring + automated grading
 *  - Reusable feedback template management
 */
@ApiTags('Grading')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('grading')
export class GradingController {
  constructor(
    private readonly rubrics: RubricsService,
    private readonly grading: GradingService,
    private readonly feedbackTemplates: FeedbackTemplatesService,
  ) {}

  // ─── Rubrics ─────────────────────────────────────────────────────────────

  @Post('rubrics')
  @ApiOperation({ summary: 'Create a new grading rubric' })
  @ApiResponse({ status: 201, description: 'Rubric created', type: Rubric })
  @ApiResponse({ status: 400, description: 'Bad Request - invalid rubric data' })
  createRubric(@Body() dto: CreateRubricDto, @Request() req: any) {
    return this.rubrics.create(dto, req.user?.id);
  }

  @Get('rubrics')
  @ApiOperation({ summary: 'List rubrics (paginated, optionally filtered by owner)' })
  @ApiQuery({ name: 'mine', required: false, type: String, description: 'Filter to own rubrics' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, description: 'List of rubrics returned' })
  listRubrics(
    @Query('mine') mine: string | undefined,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Request() req?: any,
  ) {
    return this.rubrics.findAll(
      mine === 'true' ? req?.user?.id : undefined,
      page ?? 1,
      limit ?? 10,
    );
  }

  @Get('rubrics/:id')
  @ApiOperation({ summary: 'Get a rubric with its criteria and levels' })
  @ApiResponse({ status: 200, description: 'Rubric retrieved successfully', type: Rubric })
  @ApiResponse({ status: 404, description: 'Rubric not found' })
  getRubric(@Param('id') id: string) {
    return this.rubrics.findOne(id);
  }

  @Patch('rubrics/:id')
  @ApiOperation({ summary: 'Update rubric metadata' })
  @ApiResponse({ status: 200, description: 'Rubric updated successfully', type: Rubric })
  @ApiResponse({ status: 400, description: 'Bad Request - invalid update data' })
  @ApiResponse({ status: 404, description: 'Rubric not found' })
  updateRubric(@Param('id') id: string, @Body() dto: UpdateRubricDto, @Request() req: any) {
    return this.rubrics.update(id, dto, req.user?.id);
  }

  @Delete('rubrics/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a rubric' })
  @ApiResponse({ status: 204, description: 'Rubric successfully deleted' })
  @ApiResponse({ status: 404, description: 'Rubric not found' })
  deleteRubric(@Param('id') id: string, @Request() req: any) {
    return this.rubrics.remove(id, req.user?.id);
  }

  // ─── Submission grading ──────────────────────────────────────────────────

  @Post('submissions/grade')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Score a submission against a rubric (rubric scoring interface)',
    description:
      'Provide one criterion score per rubric criterion. Each entry may use ' +
      '`levelId` to pick a predefined level, or `points` to award a custom value (capped at criterion maxPoints).',
  })
  @ApiResponse({ status: 200, description: 'Submission graded', type: SubmissionGrade })
  @ApiResponse({ status: 400, description: 'Bad Request - invalid grading payload' })
  @ApiResponse({ status: 404, description: 'Rubric or Assessment Attempt not found' })
  gradeSubmission(@Body() dto: GradeSubmissionDto, @Request() req: any) {
    return this.grading.gradeSubmission(dto, req.user?.id);
  }

  @Post('submissions/auto-grade')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Auto-grade a submission using the rubric default levels',
    description:
      'Requires the rubric to have `autoGradeEnabled=true` (every criterion has a default level).',
  })
  @ApiResponse({ status: 200, description: 'Submission auto-graded', type: SubmissionGrade })
  @ApiResponse({ status: 400, description: 'Rubric is not auto-grade enabled' })
  @ApiResponse({ status: 404, description: 'Rubric or Assessment Attempt not found' })
  autoGradeSubmission(@Body() dto: AutoGradeSubmissionDto) {
    return this.grading.autoGradeSubmission(dto);
  }

  @Get('submissions/:attemptId/grade')
  @ApiOperation({ summary: 'Get the rubric grade for an assessment attempt' })
  @ApiResponse({ status: 200, description: 'Grade retrieved successfully', type: SubmissionGrade })
  @ApiResponse({ status: 404, description: 'Grade not found for this attempt' })
  getGrade(@Param('attemptId') attemptId: string) {
    return this.grading.findByAttempt(attemptId);
  }

  // ─── Feedback templates ──────────────────────────────────────────────────

  @Post('feedback-templates')
  @ApiOperation({ summary: 'Create a reusable feedback template' })
  @ApiResponse({ status: 201, description: 'Feedback template created', type: FeedbackTemplate })
  @ApiResponse({ status: 400, description: 'Bad Request - invalid template data' })
  createTemplate(@Body() dto: CreateFeedbackTemplateDto, @Request() req: any) {
    return this.feedbackTemplates.create(dto, req.user?.id);
  }

  @Get('feedback-templates')
  @ApiOperation({ summary: 'List feedback templates (paginated)' })
  @ApiQuery({ name: 'mine', required: false, type: String, description: 'Filter to own templates' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, description: 'List of feedback templates returned' })
  listTemplates(
    @Query('mine') mine: string | undefined,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Request() req?: any,
  ) {
    return this.feedbackTemplates.findAll(
      mine === 'true' ? req?.user?.id : undefined,
      page ?? 1,
      limit ?? 10,
    );
  }

  @Get('feedback-templates/:id')
  @ApiOperation({ summary: 'Get a feedback template' })
  @ApiResponse({
    status: 200,
    description: 'Feedback template retrieved successfully',
    type: FeedbackTemplate,
  })
  @ApiResponse({ status: 404, description: 'Feedback template not found' })
  getTemplate(@Param('id') id: string) {
    return this.feedbackTemplates.findOne(id);
  }

  @Patch('feedback-templates/:id')
  @ApiOperation({ summary: 'Update a feedback template' })
  @ApiResponse({
    status: 200,
    description: 'Feedback template updated successfully',
    type: FeedbackTemplate,
  })
  @ApiResponse({ status: 400, description: 'Bad Request - invalid update data' })
  @ApiResponse({ status: 404, description: 'Feedback template not found' })
  updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateFeedbackTemplateDto,
    @Request() req: any,
  ) {
    return this.feedbackTemplates.update(id, dto, req.user?.id);
  }

  @Delete('feedback-templates/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a feedback template' })
  @ApiResponse({ status: 204, description: 'Feedback template successfully deleted' })
  @ApiResponse({ status: 404, description: 'Feedback template not found' })
  deleteTemplate(@Param('id') id: string, @Request() req: any) {
    return this.feedbackTemplates.remove(id, req.user?.id);
  }
}
