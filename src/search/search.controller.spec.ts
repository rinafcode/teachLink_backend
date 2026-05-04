import { BadRequestException } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
describe('SearchController', () => {
    let controller: SearchController;
    let searchService: jest.Mocked<SearchService>;
    beforeEach(() => {
        searchService = {
            performSearch: jest.fn(),
            getAutoComplete: jest.fn(),
            getAvailableFilters: jest.fn(),
            getSearchAnalytics: jest.fn(),
        } as unknown as jest.Mocked<SearchService>;
        controller = new SearchController(searchService);
    });
    it('parses filters and pagination before calling search service', async () => {
        searchService.performSearch.mockResolvedValueOnce({
            results: [],
            total: 0,
            page: 2,
            limit: 10,
            facets: { categories: [], levels: [], priceRanges: [] },
        });
        await controller.search('nestjs', '{"category":"backend"}', 'relevance', '2', '10');
        expect(searchService.performSearch).toHaveBeenCalledWith('nestjs', { category: 'backend' }, 'relevance', { page: 2, limit: 10 });
    });
    it('throws BadRequestException for invalid JSON filters', async () => {
        await expect(controller.search('nestjs', '{bad-json}', 'relevance', '1', '20')).rejects.toThrow(BadRequestException);
    });
    it('throws BadRequestException for invalid page', async () => {
        await expect(controller.search('nestjs', '{}', 'relevance', '0', '20')).rejects.toThrow('page must be a positive integer');
    });
    it('throws BadRequestException for invalid limit', async () => {
        await expect(controller.search('nestjs', '{}', 'relevance', '1', '100')).rejects.toThrow('limit must be an integer between 1 and 50');
    });
});
