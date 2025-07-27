import { Controller, Get, Post, Query, Body, UsePipes, ValidationPipe, BadRequestException, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { SuggestQueryDto } from './dto/suggest-query.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Full-text search with ranking' })
  @ApiResponse({ status: 200, description: 'Search results returned successfully.' })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @UsePipes(new ValidationPipe({ transform: true }))
  async search(@Query() query: SearchQueryDto, @Query() filters: any, @Query('userId') userId?: string) {
    try {
      return await this.searchService.search(query.q, filters, query.from, query.size, userId, false);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('semantic')
  @ApiOperation({ summary: 'Semantic search using embeddings' })
  @ApiResponse({ status: 200, description: 'Semantic search results returned successfully.' })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @UsePipes(new ValidationPipe({ transform: true }))
  async semanticSearch(@Query() query: SearchQueryDto, @Query() filters: any, @Query('userId') userId?: string) {
    try {
      return await this.searchService.search(query.q, filters, query.from, query.size, userId, true);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('suggest')
  @UsePipes(new ValidationPipe({ transform: true }))
  async suggest(@Query() query: SuggestQueryDto) {
    try {
      return await this.searchService.getSuggestions(query.prefix);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('click')
  async logClick(@Body('userId') userId: string, @Body('resultId') resultId: string) {
    if (!userId || !resultId) throw new BadRequestException('userId and resultId are required');
    await this.searchService.logClick(userId, resultId);
    return { success: true };
  }

  @Get('analytics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get search analytics (admin only)' })
  @ApiResponse({ status: 200, description: 'Analytics data returned successfully.' })
  async getAnalytics() {
    return this.searchService.getAnalytics();
  }
} 