import { Injectable } from '@nestjs/common';

@Injectable()
export class MilestoneTrackingService {
  initialize(path: any) {
    return {
      ...path,
      milestones: path.milestones.map((title: string) => ({
        title,
        status: 'pending',
        progress: 0,
      })),
    };
  }
}
