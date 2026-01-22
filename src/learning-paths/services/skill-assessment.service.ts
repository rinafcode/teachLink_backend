import { Injectable } from '@nestjs/common';

@Injectable()
export class SkillAssessmentService {
  assess(input: any) {
    return {
      level: input?.level ?? 'beginner',
      goal: input?.goal ?? 'general',
    };
  }
}
