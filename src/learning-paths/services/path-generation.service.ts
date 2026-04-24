import { Injectable } from '@nestjs/common';

/**
 * Provides path Generation operations.
 */
@Injectable()
export class PathGenerationService {
  /**
   * Generates generate.
   * @param assessment The assessment.
   * @returns The operation result.
   */
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
