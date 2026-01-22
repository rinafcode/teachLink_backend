import { Question } from "../entities/question.entity";
import { Repository } from "typeorm";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";

@Injectable()
export class QuestionBankService {
  constructor(
    @InjectRepository(Question)
    private readonly questionRepo: Repository<Question>,
  ) {}

  create(question: Partial<Question>) {
    return this.questionRepo.save(question);
  }

  findByAssessment(assessmentId: string) {
    return this.questionRepo.find({
      where: { assessment: { id: assessmentId } },
    });
  }
}
