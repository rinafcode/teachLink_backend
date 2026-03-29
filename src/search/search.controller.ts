import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async search(
    @Query('q') query: string,
    @Query('filters') filters?: string,
    @Query('sort') sort?: string,
  ) {
    let parsedFilters: Record<string, any> = {};
    if (filters) {
      try {
        parsedFilters = JSON.parse(filters);
      } catch {
        throw new BadRequestException('filters must be valid JSON');
      }
    }
    return this.searchService.performSearch(query, parsedFilters, sort);
  }

  @Get('autocomplete')
  async autocomplete(@Query('q') query: string) {
    return this.searchService.getAutoComplete(query);
  }

  @Get('filters')
  async getFilters() {
    return this.searchService.getAvailableFilters();
  }

  @Get('analytics')
  async getAnalytics(@Query('days') days?: string) {
    const parsedDays = days ? parseInt(days, 10) : 7;
    return this.searchService.getSearchAnalytics(parsedDays);
  }
}
