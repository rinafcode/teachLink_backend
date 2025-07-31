import { Injectable } from '@nestjs/common';

@Injectable()
export class EducationalEffectivenessService {
  measureEffectiveness(learnerId: string) {
    console.log(learnerId);
    return {
      improvementScore: 0.7,
      quizPerformanceChange: '+15%',
      contentEngagement: 'high',
    };
  }
}
