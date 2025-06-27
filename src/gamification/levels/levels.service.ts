import { Injectable } from '@nestjs/common';

@Injectable()
export class LevelsService {
  async getLevel(points: number): Promise<number> {
    // Example: every 100 points is a new level
    return Math.floor(points / 100) + 1;
  }
}
