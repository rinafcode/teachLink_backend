import { Injectable } from '@nestjs/common';

@Injectable()
export class SkillAssessmentService {
  async evaluate(userId: string, answers: Record<string, any>) {
    return {
      frontend: 3,
      backend: 1,
      data: 2,
    };
  }
}
