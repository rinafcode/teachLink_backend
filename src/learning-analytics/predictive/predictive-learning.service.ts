import { Injectable } from '@nestjs/common';

@Injectable()
export class PredictiveLearningService {
  forecastSuccess(learnerId: string) {
    console.log(learnerId);
    return 0.85; // mock score
  }

  recommendNextSteps(learnerId: string) {
    console.log(learnerId);
    return ['Watch advanced video lessons', 'Take weekly quizzes'];
  }
}
