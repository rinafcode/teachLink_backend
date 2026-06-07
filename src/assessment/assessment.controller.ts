import { Body, Controller, Get, Param, Post, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AssessmentsService } from './assessments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubmitAssessmentDto } from './dto/submit-assessment.dto';

/**
 * Exposes assessments endpoints.
 */
@ApiTags('Assessments')
@ApiBearerAuth()
@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly service: AssessmentsService) {}

  /**
   * Starts start.
   * @param req The req.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Post(':id/start')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Start an assessment attempt' })
  @ApiResponse({ status: 201, description: 'Assessment attempt started' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  start(@Request() req: any, @Param('id') id: string): any {
    const studentId = req.user.id;
    if (!studentId) {
      throw new Error('User not authenticated');
    }
    return this.service.startAssessment(studentId, id);
  }

  /**
   * Submits submit.
   * @param req The req.
   * @param id The identifier.
   * @param answers The answers.
   * @returns The operation result.
   */
  @Post('attempts/:id/submit')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Submit assessment answers' })
  @ApiResponse({ status: 201, description: 'Assessment submitted and scored' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  async submit(@Request() req: any, @Param('id') id: string, @Body() submitAssessmentDto: SubmitAssessmentDto): any {
    return this.service.submitAssessment(id, submitAssessmentDto.answers);
  }

  /**
   * Executes results.
   * @param req The req.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Get('attempts/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get assessment attempt results' })
  @ApiResponse({ status: 200, description: 'Assessment attempt results' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  results(@Request() req: any, @Param('id') id: string): any {
    return this.service.getResults(id);
  }
}
