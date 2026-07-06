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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RubricsService } from './rubrics.service';
import { GradingService } from './grading.service';
import { FeedbackTemplatesService } from './feedback-templates.service';
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
  @ApiResponse({ status: 201, description: 'Rubric created' })
  createRubric(@Body() dto: CreateRubricDto, @Request() req: any) {
    return this.rubrics.create(dto, req.user?.id);
  }

  @Get('rubrics')
  @ApiOperation({ summary: 'List rubrics (optionally filtered by owner)' })
  listRubrics(@Query('mine') mine: string | undefined, @Request() req: any) {
    return this.rubrics.findAll(mine === 'true' ? req.user?.id : undefined);
  }

  @Get('rubrics/:id')
  @ApiOperation({ summary: 'Get a rubric with its criteria and levels' })
  getRubric(@Param('id') id: string) {
    return this.rubrics.findOne(id);
  }

  @Patch('rubrics/:id')
  @ApiOperation({ summary: 'Update rubric metadata' })
  updateRubric(@Param('id') id: string, @Body() dto: UpdateRubricDto, @Request() req: any) {
    return this.rubrics.update(id, dto, req.user?.id);
  }

  @Delete('rubrics/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a rubric' })
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
  @ApiResponse({ status: 200, description: 'Submission graded' })
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
  @ApiResponse({ status: 200, description: 'Submission auto-graded' })
  @ApiResponse({ status: 400, description: 'Rubric is not auto-grade enabled' })
  autoGradeSubmission(@Body() dto: AutoGradeSubmissionDto) {
    return this.grading.autoGradeSubmission(dto);
  }

  @Get('submissions/:attemptId/grade')
  @ApiOperation({ summary: 'Get the rubric grade for an assessment attempt' })
  getGrade(@Param('attemptId') attemptId: string) {
    return this.grading.findByAttempt(attemptId);
  }

  // ─── Feedback templates ──────────────────────────────────────────────────

  @Post('feedback-templates')
  @ApiOperation({ summary: 'Create a reusable feedback template' })
  createTemplate(@Body() dto: CreateFeedbackTemplateDto, @Request() req: any) {
    return this.feedbackTemplates.create(dto, req.user?.id);
  }

  @Get('feedback-templates')
  @ApiOperation({ summary: 'List feedback templates' })
  listTemplates(@Query('mine') mine: string | undefined, @Request() req: any) {
    return this.feedbackTemplates.findAll(mine === 'true' ? req.user?.id : undefined);
  }

  @Get('feedback-templates/:id')
  @ApiOperation({ summary: 'Get a feedback template' })
  getTemplate(@Param('id') id: string) {
    return this.feedbackTemplates.findOne(id);
  }

  @Patch('feedback-templates/:id')
  @ApiOperation({ summary: 'Update a feedback template' })
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
  deleteTemplate(@Param('id') id: string, @Request() req: any) {
    return this.feedbackTemplates.remove(id, req.user?.id);
  }
}
