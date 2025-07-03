import { Injectable } from '@nestjs/common';

@Injectable()
export class SearchFiltersService {
  buildFilterQuery(filters: any) {
    const filterClauses = [];
    if (filters.category) {
      filterClauses.push({ term: { category: filters.category } });
    }
    if (filters.level) {
      filterClauses.push({ term: { level: filters.level } });
    }
    // Add more filters as needed
    return filterClauses;
  }
} 