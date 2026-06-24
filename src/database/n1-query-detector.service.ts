import { Injectable, Logger } from '@nestjs/common';

export interface N1QueryReport {
  location: string;
  description: string;
  recommendation: string;
  severity: 'low' | 'medium' | 'high';
}

export interface RelationLoadStrategy {
  relation: string;
  useEagerLoading: boolean;
  joinType: 'leftJoin' | 'innerJoin';
}

/**
 * Detects N+1 query patterns by analysing a batch of SQL strings captured
 * during a single request lifecycle.
 *
 * Usage: enable TypeORM query logging, collect emitted SQL strings per
 * request, then pass them to `detectPatterns` to surface repeated queries.
 */
@Injectable()
export class N1QueryDetectorService {
  private readonly logger = new Logger(N1QueryDetectorService.name);

  /**
   * Groups queries by their normalised template and flags any template
   * executed more than once — the hallmark of an N+1 problem.
   */
  detectPatterns(queries: string[]): N1QueryReport[] {
    const reports: N1QueryReport[] = [];
    const queryMap = new Map<string, number>();

    for (const query of queries) {
      const template = this.normalise(query);
      const count = (queryMap.get(template) ?? 0) + 1;
      queryMap.set(template, count);
    }

    for (const [template, count] of queryMap.entries()) {
      if (count < 2) {
        continue;
      }
      reports.push({
        location: template,
        description: `Query executed ${count}x -- N+1 pattern likely.`,
        recommendation: 'Replace with a single JOIN or TypeORM eager loading.',
        severity: count > 10 ? 'high' : count > 3 ? 'medium' : 'low',
      });
    }

    if (reports.length === 0) {
      this.logger.debug('No N+1 patterns detected in the provided query set.');
    }

    return reports;
  }

  /**
   * Returns recommended eager-load strategies for entity relations known to
   * cause N+1 problems in TeachLink when accessed without explicit joins.
   */
  getRecommendedStrategies(): RelationLoadStrategy[] {
    return [
      { relation: 'courses.instructor', useEagerLoading: true, joinType: 'leftJoin' },
      { relation: 'enrollments.course', useEagerLoading: true, joinType: 'leftJoin' },
      { relation: 'payments.transaction', useEagerLoading: true, joinType: 'leftJoin' },
      { relation: 'users.roles', useEagerLoading: true, joinType: 'leftJoin' },
    ];
  }

  /**
   * Replaces literals (positional params, quoted strings, bare numbers) with
   * placeholders so structurally identical queries with different values are
   * treated as the same template.
   */
  private normalise(sql: string): string {
    return sql
      .toLowerCase()
      .replace(/\$\d+/g, '$?')
      .replace(/'[^']*'/g, "'?'")
      .replace(/\b\d+\b/g, '?');
  }
}
