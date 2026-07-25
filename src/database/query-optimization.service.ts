import { Injectable, Logger } from '@nestjs/common';

export interface QuerySuggestion {
  issue: string;
  suggestion: string;
}

@Injectable()
export class QueryOptimizationService {
  private readonly logger = new Logger(QueryOptimizationService.name);

  /**
   * Analyses a SQL query string and returns simple optimisation suggestions.
   */
  analyse(sql: string): QuerySuggestion[] {
    const suggestions: QuerySuggestion[] = [];
    const q = sql.toLowerCase();

    if (q.includes('select *')) {
      suggestions.push({
        issue: 'SELECT *',
        suggestion: 'Select only required columns to reduce data transfer.',
      });
    }
    if (!q.includes('where') && (q.includes('update') || q.includes('delete'))) {
      suggestions.push({
        issue: 'Missing WHERE',
        suggestion: 'Add a WHERE clause to avoid full-table mutations.',
      });
    }
    if (q.includes('like') && q.match(/like\s+'%[^%]/)) {
      suggestions.push({
        issue: 'Leading wildcard',
        suggestion: 'Avoid leading % in LIKE — it prevents index use.',
      });
    }
    if (suggestions.length === 0) {
      this.logger.debug('No issues found in query.');
    }
    return suggestions;
  }
}
