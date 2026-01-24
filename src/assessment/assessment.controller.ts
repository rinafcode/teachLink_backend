import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AssessmentsService } from './assessments.service';



@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly service: AssessmentsService) {}

  @Post(':id/start')
  start(
    @Param('id') id: string,
    @Body('studentId') studentId: string,
  ) {
    return this.service.startAssessment(studentId, id);
  }

  @Post('attempts/:id/submit')
  submit(
    @Param('id') id: string,
    @Body('answers') answers: any[],
  ) {
    return this.service.submitAssessment(id, answers);
  }

  @Get('attempts/:id')
  results(@Param('id') id: string) {
    return this.service.getResults(id);
  }
}
