import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { SearchQueryDto } from './dto/search-query.dto';
import { SuggestQueryDto } from './dto/suggest-query.dto';

describe('SearchController', () => {
  let controller: SearchController;
  let service: { search: jest.Mock; getSuggestions: jest.Mock };

  beforeEach(async () => {
    service = {
      search: jest.fn().mockResolvedValue(['result']),
      getSuggestions: jest.fn().mockResolvedValue(['suggestion']),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [{ provide: SearchService, useValue: service }],
    }).compile();

    controller = module.get<SearchController>(SearchController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call search service', async () => {
    const query: SearchQueryDto = { q: 'test', from: 0, size: 10 };
    const result = await controller.search(query, {});
    expect(result).toEqual(['result']);
    expect(service.search).toHaveBeenCalledWith('test', {}, 0, 10);
  });

  it('should throw BadRequestException on search error', async () => {
    service.search.mockRejectedValue(new BadRequestException('error'));
    const query: SearchQueryDto = { q: 'test', from: 0, size: 10 };
    await expect(controller.search(query, {})).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should call suggest service', async () => {
    const query: SuggestQueryDto = { prefix: 'te' };
    const result = await controller.suggest(query);
    expect(result).toEqual(['suggestion']);
    expect(service.getSuggestions).toHaveBeenCalledWith('te');
  });

  it('should throw BadRequestException on suggest error', async () => {
    service.getSuggestions.mockRejectedValue(new BadRequestException('error'));
    const query: SuggestQueryDto = { prefix: 'te' };
    await expect(controller.suggest(query)).rejects.toThrow(
      BadRequestException,
    );
  });
});
