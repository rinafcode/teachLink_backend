import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BadgesService } from './badges.service';
import { LeaderboardService } from '../leaderboards/leaderboards.service';
import { CreateBadgeDto, BadgeFilterDto, LeaderboardQueryDto } from '../dto/badge.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { BadgeCategory } from '../enums/badge-category.enum';

@ApiTags('Gamification - Badges')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('gamification')
export class BadgesController {
  constructor(
    private readonly badgesService: BadgesService,
    private readonly leaderboardService: LeaderboardService,
  ) {}

  // ─── Badges ───────────────────────────────────────────────────────────────

  @Get('badges')
  @ApiOperation({ summary: 'Get all badges, optionally filtered by category' })
  getAllBadges(@Query() filter: BadgeFilterDto) {
    return this.badgesService.getAllBadges(filter);
  }

  @Get('badges/categories')
  @ApiOperation({ summary: 'Get all badge categories' })
  getCategories() {
    return Object.values(BadgeCategory);
  }

  @Get('badges/category/:category')
  @ApiOperation({ summary: 'Get badges by category' })
  getBadgesByCategory(@Param('category') category: BadgeCategory) {
    return this.badgesService.getBadgesByCategory(category);
  }

  @Get('badges/:id')
  @ApiOperation({ summary: 'Get a badge by ID' })
  getBadge(@Param('id', ParseUUIDPipe) id: string) {
    return this.badgesService.getBadgeById(id);
  }

  @Post('badges')
  @ApiOperation({ summary: 'Create a new badge definition (admin)' })
  createBadge(@Body() dto: CreateBadgeDto) {
    return this.badgesService.createBadge(dto);
  }

  @Post('badges/seed')
  @ApiOperation({ summary: 'Seed default badge definitions (admin/dev)' })
  seedBadges() {
    return this.badgesService.seedDefaultBadges();
  }

  // ─── My Badges ────────────────────────────────────────────────────────────

  @Get('my/badges')
  @ApiOperation({ summary: 'Get all badges earned by the current user' })
  getMyBadges(@CurrentUser() user: { id: string }) {
    return this.badgesService.getUserBadges(user.id);
  }

  @Get('my/badges/category/:category')
  @ApiOperation({ summary: 'Get current user badges filtered by category' })
  getMyBadgesByCategory(
    @CurrentUser() user: { id: string },
    @Param('category') category: BadgeCategory,
  ) {
    return this.badgesService.getUserBadgesByCategory(user.id, category);
  }

  @Get('my/badges/count')
  @ApiOperation({ summary: 'Get total badge count for current user' })
  async getMyBadgeCount(@CurrentUser() user: { id: string }) {
    const count = await this.badgesService.getUserBadgeCount(user.id);
    return { count };
  }

  // ─── Leaderboards ─────────────────────────────────────────────────────────

  @Get('leaderboard/points')
  @ApiOperation({ summary: 'Get top players by points' })
  getPointsLeaderboard(@Query() query: LeaderboardQueryDto) {
    return this.leaderboardService.getTopPlayers(query.limit ?? 10);
  }

  @Get('leaderboard/badges')
  @ApiOperation({ summary: 'Get top players by badge count' })
  getBadgeLeaderboard(@Query() query: LeaderboardQueryDto) {
    return this.leaderboardService.getBadgeLeaderboard(query.limit ?? 10, query.category);
  }

  @Get('leaderboard/my-rank')
  @ApiOperation({ summary: 'Get current user rank on the points leaderboard' })
  async getMyRank(@CurrentUser() user: { id: string }) {
    const rank = await this.leaderboardService.getUserRank(user.id);
    return { rank };
  }

  @Get('leaderboard/my-badge-rank')
  @ApiOperation({ summary: 'Get current user rank on the badge leaderboard' })
  async getMyBadgeRank(
    @CurrentUser() user: { id: string },
    @Query('category') category?: BadgeCategory,
  ) {
    const rank = await this.leaderboardService.getUserBadgeRank(user.id, category);
    return { rank };
  }

  // ─── Other Users ──────────────────────────────────────────────────────────

  @Get('users/:userId/badges')
  @ApiOperation({ summary: 'Get badges for a specific user' })
  getUserBadges(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.badgesService.getUserBadges(userId);
  }
}
