import { Body, Controller, Get, Param, Post, UseGuards, Request } from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Exposes assessments endpoints.
 */
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
  submit(@Request() req: any, @Param('id') id: string, @Body('answers') answers: any[]): any {
    return this.service.submitAssessment(id, answers);
  }

  /**
   * Executes results.
   * @param req The req.
   * @param id The identifier.
   * @returns The operation result.
   */
  @Get('attempts/:id')
  @UseGuards(JwtAuthGuard)
  results(@Request() req: any, @Param('id') id: string): any {
    return this.service.getResults(id);
  }
}
