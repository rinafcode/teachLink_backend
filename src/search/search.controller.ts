import { Controller, Get, Query, UsePipes, ValidationPipe, BadRequestException } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { SuggestQueryDto } from './dto/suggest-query.dto';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @UsePipes(new ValidationPipe({ transform: true }))
  async search(@Query() query: SearchQueryDto, @Query() filters: any) {
    try {
      return await this.searchService.search(query.q, filters, query.from, query.size);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('suggest')
  @UsePipes(new ValidationPipe({ transform: true }))
  async suggest(@Query() query: SuggestQueryDto) {
    try {
      return await this.searchService.getSuggestions(query.prefix);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
} 