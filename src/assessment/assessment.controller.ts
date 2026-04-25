import { Body, Controller, Get, Param, Post, UseGuards, Request } from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
@Controller('assessments')
export class AssessmentsController {
    constructor(private readonly service: AssessmentsService) { }
    @Post(':id/start')
    @UseGuards(JwtAuthGuard)
    start(
    @Request()
    req: unknown, 
    @Param('id')
    id: string): unknown {
        const studentId = req.user.id;
        if (!studentId) {
            throw new Error('User not authenticated');
        }
        return this.service.startAssessment(studentId, id);
    }
    @Post('attempts/:id/submit')
    @UseGuards(JwtAuthGuard)
    submit(
    @Request()
    req: unknown, 
    @Param('id')
    id: string, 
    @Body('answers')
    answers: unknown[]): unknown {
        return this.service.submitAssessment(id, answers);
    }
    @Get('attempts/:id')
    @UseGuards(JwtAuthGuard)
    results(
    @Request()
    req: unknown, 
    @Param('id')
    id: string): unknown {
        return this.service.getResults(id);
    }
}
