import { Question } from '../entities/question.entity';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
@Injectable()
export class QuestionBankService {
    constructor(
    @InjectRepository(Question)
    private readonly questionRepo: Repository<Question>) { }
    create(question: Partial<Question>): Promise<Question> {
        return this.questionRepo.save(question);
    }
    findByAssessment(assessmentId: string): Promise<Question[]> {
        return this.questionRepo.find({
            where: { assessment: { id: assessmentId } },
        });
    }
}
