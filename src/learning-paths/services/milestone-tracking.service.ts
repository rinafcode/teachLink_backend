import { Injectable } from '@nestjs/common';

/**
 * Provides milestone Tracking operations.
 */
@Injectable()
export class MilestoneTrackingService {
  /**
   * Executes initialize.
   * @param path The path.
   * @returns The operation result.
   */
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
