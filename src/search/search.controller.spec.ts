import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { BadRequestException } from '@nestjs/common';

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

  it('should call search service and return results', async () => {
    const query = { q: 'test', from: 0, size: 10 };
    const filters = {};
    const result = await controller.search(query, filters);
    expect(result).toEqual(['result']);
    expect(service.search).toHaveBeenCalledWith('test', filters, 0, 10);
  });

  it('should throw BadRequestException if search service throws', async () => {
    service.search.mockRejectedValue(new Error('fail'));
    await expect(controller.search({ q: 'fail', from: 0, size: 10 }, {})).rejects.toThrow(BadRequestException);
  });

  it('should call suggest service and return suggestions', async () => {
    const query = { prefix: 'te' };
    const result = await controller.suggest(query);
    expect(result).toEqual(['suggestion']);
    expect(service.getSuggestions).toHaveBeenCalledWith('te');
  });

  it('should throw BadRequestException if suggest service throws', async () => {
    service.getSuggestions.mockRejectedValue(new Error('fail'));
    await expect(controller.suggest({ prefix: 'fail' })).rejects.toThrow(BadRequestException);
  });
}); 