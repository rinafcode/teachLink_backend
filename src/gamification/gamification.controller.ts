import { Controller, Post, Body } from '@nestjs/common';
import { GamificationService } from './gamification.service';

@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Post('award')
  async awardPoints(
    @Body() body: { userId: string; activity: string; points: number },
  ) {
    await this.gamificationService.awardPoints(
      body.userId,
      body.activity,
      body.points,
    );
    return { message: 'Points awarded and gamification updated.' };
  }
}
