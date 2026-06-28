import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { THROTTLE } from '../common/constants/throttle.constants';
import { SearchService } from './search.service';

@ApiTags('Search')
@Throttle({ default: THROTTLE.SEARCH })
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /**
   * Returns search.
   * @param query The query value.
   * @param filters The filter criteria.
   * @param sort The sort.
   * @param page The page number.
   * @param limit The maximum number of results.
   * @returns The operation result.
   */
  @Get()
  @ApiOperation({ summary: 'Search courses and learning content' })
  @ApiQuery({ name: 'q', required: true, example: 'javascript basics' })
  @ApiQuery({
    name: 'filters',
    required: false,
    description: 'JSON encoded search filters',
    example: '{"category":"programming","level":"beginner"}',
  })
  @ApiQuery({ name: 'sort', required: false, example: 'relevance' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({
    status: 200,
    description: 'Search results',
    schema: {
      example: {
        results: [],
        total: 0,
        page: 1,
        limit: 20,
        filters: { category: 'programming', level: 'beginner' },
        query: 'javascript basics',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid filters JSON' })
  async search(
    @Query('q') query: string,
    @Query('filters') filters?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<any> {
    let parsedFilters: Record<string, any> = {};
    if (filters) {
      try {
        parsedFilters = JSON.parse(filters);
      } catch {
        throw new BadRequestException('filters must be valid JSON');
      }
    }

    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;

    return this.searchService.search(query, parsedFilters, sort, pageNum, limitNum);
  }

  @Get('autocomplete')
  @ApiOperation({ summary: 'Get search autocomplete suggestions' })
  @ApiQuery({ name: 'q', required: true, example: 'java' })
  @ApiResponse({
    status: 200,
    description: 'Autocomplete suggestions',
    schema: { example: ['javascript', 'java fundamentals', 'java spring'] },
  })
  async autocomplete(
    @Query('q')
    query: string,
  ): Promise<unknown> {
    return this.searchService.getAutoComplete(query);
  }

  @Get('filters')
  @ApiOperation({ summary: 'Get available search filters' })
  @ApiResponse({
    status: 200,
    description: 'Available filters',
    schema: {
      example: {
        categories: ['programming', 'design'],
        levels: ['beginner', 'intermediate'],
        languages: ['en'],
        priceRanges: [{ label: 'Free', lte: 0 }],
      },
    },
  })
  async getFilters(): Promise<unknown> {
    return this.searchService.getAvailableFilters();
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get search analytics' })
  @ApiQuery({ name: 'days', required: false, example: 7 })
  @ApiResponse({
    status: 200,
    description: 'Search analytics summary',
    schema: {
      example: {
        topQueries: [{ query: 'javascript', count: 42 }],
        totalSearches: 120,
        averageResults: 8.4,
      },
    },
  })
  async getAnalytics(
    @Query('days')
    _days?: string,
  ): Promise<unknown> {
    return this.searchService
      .search('', {}, '', 1, 1000)
      .then((res) => (res?.results?.length ? { totalResults: res.total } : { totalResults: 0 }));
  }
}
