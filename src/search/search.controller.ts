import { Controller, Get, Query } from '@nestjs/common';
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
    const parsedFilters = filters ? JSON.parse(filters) : {};
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
}
