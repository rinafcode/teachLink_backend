import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { AutoCompleteService } from './autocomplete/autocomplete.service';
import { SearchFiltersService } from './filters/search-filters.service';
import { BadRequestException } from '@nestjs/common';

describe('SearchService', () => {
  let service: SearchService;
  let esService: { search: jest.Mock };
  let autoCompleteService: { getSuggestions: jest.Mock };
  let filtersService: { buildFilterQuery: jest.Mock };

  beforeEach(async () => {
    esService = { search: jest.fn() };
    autoCompleteService = { getSuggestions: jest.fn() };
    filtersService = { buildFilterQuery: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: ElasticsearchService, useValue: esService },
        { provide: AutoCompleteService, useValue: autoCompleteService },
        { provide: SearchFiltersService, useValue: filtersService },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should perform a search and return results', async () => {
    filtersService.buildFilterQuery.mockReturnValue([]);
    esService.search.mockResolvedValue({
      hits: { hits: [{ _source: { title: 'Test Course' } }] },
    });

    const results = await service.search('test', {}, 0, 10);
    expect(results).toEqual([{ title: 'Test Course' }]);
    expect(esService.search).toHaveBeenCalled();
  });

  it('should throw BadRequestException on search error', async () => {
    filtersService.buildFilterQuery.mockReturnValue([]);
    esService.search.mockRejectedValue(new Error('ES error'));

    await expect(service.search('test', {}, 0, 10)).rejects.toThrow(BadRequestException);
  });

  it('should get suggestions', async () => {
    autoCompleteService.getSuggestions.mockResolvedValue(['suggestion1', 'suggestion2']);
    const suggestions = await service.getSuggestions('sug');
    expect(suggestions).toEqual(['suggestion1', 'suggestion2']);
    expect(autoCompleteService.getSuggestions).toHaveBeenCalledWith('sug');
  });

  it('should throw BadRequestException on suggestion error', async () => {
    autoCompleteService.getSuggestions.mockRejectedValue(new Error('Suggest error'));
    await expect(service.getSuggestions('sug')).rejects.toThrow(BadRequestException);
  });
}); 