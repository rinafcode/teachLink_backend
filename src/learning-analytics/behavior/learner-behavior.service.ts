import { Injectable } from '@nestjs/common';

@Injectable()
export class LearnerBehaviorService {
  private behaviorLog = new Map<string, any[]>();

  trackBehavior(learnerId: string, event: any) {
    const logs = this.behaviorLog.get(learnerId) || [];
    logs.push({ event, timestamp: new Date() });
    this.behaviorLog.set(learnerId, logs);
  }

  analyzePatterns(learnerId: string) {
    const logs = this.behaviorLog.get(learnerId) || [];
    return {
      totalEvents: logs.length,
      preferredContentType: 'video',
      activeHours: 'evening',
    };
  }
}
