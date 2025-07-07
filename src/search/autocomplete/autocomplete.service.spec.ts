import { Test, TestingModule } from '@nestjs/testing';
import { AutoCompleteService } from './autocomplete.service';
import { ElasticsearchService } from '@nestjs/elasticsearch';

describe('AutoCompleteService', () => {
  let service: AutoCompleteService;
  let esService: { search: jest.Mock };

  beforeEach(async () => {
    esService = { search: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutoCompleteService,
        { provide: ElasticsearchService, useValue: esService },
      ],
    }).compile();

    service = module.get<AutoCompleteService>(AutoCompleteService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return suggestions', async () => {
    esService.search.mockResolvedValue({
      suggest: {
        course_suggest: [
          { options: [{ text: 'foo' }, { text: 'bar' }] },
        ],
      },
    });

    const suggestions = await service.getSuggestions('f');
    expect(suggestions).toEqual(['foo', 'bar']);
    expect(esService.search).toHaveBeenCalled();
  });

  it('should throw if elasticsearch fails', async () => {
    esService.search.mockRejectedValue(new Error('fail'));
    await expect(service.getSuggestions('fail')).rejects.toThrow();
  });
}); 