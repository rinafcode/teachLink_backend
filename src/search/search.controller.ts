import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { THROTTLE } from '../common/constants/throttle.constants';
import { SearchService } from './search.service';

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
    @Get('autocomplete')
    async autocomplete(
    @Query('q')
    query: string): Promise<unknown> {
        return this.searchService.getAutoComplete(query);
    }
    @Get('filters')
    async getFilters(): Promise<unknown> {
        return this.searchService.getAvailableFilters();
    }
    @Get('analytics')
    async getAnalytics(
    @Query('days')
    days?: string): Promise<unknown> {
        const parsedDays = days ? parseInt(days, 10) : 7;
        return this.searchService.getSearchAnalytics(parsedDays);
    }

    return this.searchService.performSearch(query, parsedFilters, sort, {
      page: parsedPage,
      limit: parsedLimit,
    });
  }

  /**
   * Executes autocomplete.
   * @param query The query value.
   * @returns The operation result.
   */
  @Get('autocomplete')
  async autocomplete(@Query('q') query: string): Promise<any> {
    return this.searchService.getAutoComplete(query);
  }

  /**
   * Returns filters.
   * @returns The operation result.
   */
  @Get('filters')
  async getFilters(): Promise<any> {
    return this.searchService.getAvailableFilters();
  }

  /**
   * Returns analytics.
   * @param days The days.
   * @returns The operation result.
   */
  @Get('analytics')
  async getAnalytics(@Query('days') days?: string): Promise<any> {
    const parsedDays = days ? parseInt(days, 10) : 7;
    return this.searchService.getSearchAnalytics(parsedDays);
  }
}
