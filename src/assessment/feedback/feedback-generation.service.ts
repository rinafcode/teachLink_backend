import { Injectable } from '@nestjs/common';

/**
 * Provides feedback Generation operations.
 */
@Injectable()
export class FeedbackGenerationService {
    generate(score: number, maxScore: number): string {
        const percentage = (score / maxScore) * 100;
        if (percentage >= 80)
            return 'Excellent performance 🎉';
        if (percentage >= 50)
            return 'Good job, but there is room to improve 👍';
        return 'Keep practicing, you can do better 💪';
    }
}
