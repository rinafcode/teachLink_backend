import { Injectable } from '@nestjs/common';

@Injectable()
export class PathGenerationService {
  generate(assessment: { level: string; goal: string }) {
    const milestones = [];

    if (assessment.level === 'beginner') {
      milestones.push('Fundamentals');
    }

    if (assessment.goal === 'frontend') {
      milestones.push('HTML', 'CSS', 'JavaScript', 'React');
    }

    return {
      goal: assessment.goal,
      level: assessment.level,
      milestones,
    };
  }
}
