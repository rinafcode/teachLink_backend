import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SearchService } from './search.service';
@Throttle({ default: { limit: 30, ttl: 60000 } })
@Controller('search')
export class SearchController {
    constructor(private readonly searchService: SearchService) { }
    @Get()
    async search(
    @Query('q')
    query: string, 
    @Query('filters')
    filters?: string, 
    @Query('sort')
    sort?: string, 
    @Query('page')
    page?: string, 
    @Query('limit')
    limit?: string): Promise<unknown> {
        let parsedFilters: Record<string, unknown> = {};
        if (filters) {
            try {
                parsedFilters = JSON.parse(filters);
            }
            catch {
                throw new BadRequestException('filters must be valid JSON');
            }
        }
        const parsedPage = page ? Number.parseInt(page, 10) : 1;
        const parsedLimit = limit ? Number.parseInt(limit, 10) : 20;
        if (!Number.isInteger(parsedPage) || parsedPage < 1) {
            throw new BadRequestException('page must be a positive integer');
        }
        if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
            throw new BadRequestException('limit must be an integer between 1 and 50');
        }
        return this.searchService.performSearch(query, parsedFilters, sort, {
            page: parsedPage,
            limit: parsedLimit,
        });
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
}
