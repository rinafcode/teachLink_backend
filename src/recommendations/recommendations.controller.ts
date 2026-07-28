import { Controller, Get, Query, ParseUUIDPipe, Param } from '@nestjs/common';
import { RecommendationEngineService } from './recommendation-engine.service';
import { GetRecommendationsDto } from './dto/recommendation.dto';

@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly engine: RecommendationEngineService) {}

  /**
   * GET /recommendations/:userId
   *
   * Returns a ranked list of personalised course recommendations for the given user.
   * Results are cached in Redis (TTL 5 min) to achieve <100 ms response times.
   */
  @Get(':userId')
  getRecommendations(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: GetRecommendationsDto,
  ) {
    return this.engine.getRecommendations(userId, query.limit);
  }
}
