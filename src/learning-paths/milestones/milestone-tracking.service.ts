import { Injectable } from '@nestjs/common';

@Injectable()
export class MilestoneTrackingService {
  async initializeMilestones(userId: string, path: any[]) {
    return {
      userId,
      milestones: path.map((step, index) => ({
        id: index + 1,
        title: step.title,
        completed: false,
      })),
    };
  }
}
