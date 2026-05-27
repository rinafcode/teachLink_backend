import { Injectable, Logger } from '@nestjs/common';
import {
  RoutingRule,
  RoutingCondition,
  RoutingContext,
  RoutingResult,
  RoutingConditionType,
  RoutingOperator,
  DynamicRoutingConfig,
  RoutingTransformation,
} from '../interfaces/routing.interface';

/**
 * Core routing engine that evaluates rules and determines routing actions
 */
@Injectable()
export class RoutingEngineService {
  private readonly logger = new Logger(RoutingEngineService.name);
  private config: DynamicRoutingConfig;
  private ruleCache = new Map<string, RoutingResult>();

  constructor() {
    this.config = {
      rules: [],
      enableLogging: true,
      enableMetrics: true,
      cacheConfig: {
        enabled: true,
        ttl: 300000, // 5 minutes
        maxSize: 1000,
      },
    };
  }

  /**
   * Updates the routing configuration
   */
  updateConfig(config: DynamicRoutingConfig): void {
    this.config = { ...this.config, ...config };
    this.clearCache();
    this.logger.log(`Routing configuration updated with ${config.rules.length} rules`);
  }

  /**
   * Evaluates routing rules against the given context
   */
  async evaluateRouting(context: RoutingContext): Promise<RoutingResult> {
    const cacheKey = this.generateCacheKey(context);

    // Check cache first
    if (this.config.cacheConfig?.enabled && this.ruleCache.has(cacheKey)) {
      const cachedResult = this.ruleCache.get(cacheKey)!;
      if (this.config.enableLogging) {
        this.logger.debug(`Cache hit for routing evaluation: ${cacheKey}`);
      }
      return cachedResult;
    }

    // Sort rules by priority (higher priority first)
    const sortedRules = [...this.config.rules]
      .filter((rule) => rule.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (await this.evaluateRule(rule, context)) {
        const result: RoutingResult = {
          matched: true,
          rule,
          action: rule.action,
          transformedRequest: this.applyTransformations(
            context.request,
            rule.action.transformations,
          ),
          metadata: {
            ruleId: rule.id,
            ruleName: rule.name,
            evaluatedAt: new Date().toISOString(),
            ...rule.metadata,
          },
        };

        // Cache the result
        if (this.config.cacheConfig?.enabled) {
          this.cacheResult(cacheKey, result);
        }

        if (this.config.enableLogging) {
          this.logger.log(`Routing rule matched: ${rule.name} (${rule.id})`);
        }

        return result;
      }
    }

    // No rule matched, return default result
    const defaultResult: RoutingResult = {
      matched: false,
      action: this.config.defaultAction,
      metadata: {
        evaluatedAt: new Date().toISOString(),
        rulesEvaluated: sortedRules.length,
      },
    };

    if (this.config.cacheConfig?.enabled) {
      this.cacheResult(cacheKey, defaultResult);
    }

    return defaultResult;
  }

  /**
   * Evaluates a single routing rule against the context
   */
  private async evaluateRule(rule: RoutingRule, context: RoutingContext): Promise<boolean> {
    if (!rule.conditions || rule.conditions.length === 0) {
      return false;
    }

    // All conditions must be true (AND logic)
    for (const condition of rule.conditions) {
      if (!(await this.evaluateCondition(condition, context))) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluates a single condition against the context
   */
  private async evaluateCondition(
    condition: RoutingCondition,
    context: RoutingContext,
  ): Promise<boolean> {
    const value = this.extractValue(condition, context);
    const targetValue = condition.value;

    if (value === undefined || value === null) {
      return condition.operator === RoutingOperator.NOT_EXISTS;
    }

    if (condition.operator === RoutingOperator.EXISTS) {
      return true;
    }

    const compareValue =
      condition.caseSensitive === false ? String(value).toLowerCase() : String(value);
    const compareTarget =
      condition.caseSensitive === false && typeof targetValue === 'string'
        ? targetValue.toLowerCase()
        : targetValue;

    switch (condition.operator) {
      case RoutingOperator.EQUALS:
        return compareValue === compareTarget;

      case RoutingOperator.NOT_EQUALS:
        return compareValue !== compareTarget;

      case RoutingOperator.CONTAINS:
        return typeof compareTarget === 'string' && compareValue.includes(compareTarget);

      case RoutingOperator.NOT_CONTAINS:
        return typeof compareTarget === 'string' && !compareValue.includes(compareTarget);

      case RoutingOperator.STARTS_WITH:
        return typeof compareTarget === 'string' && compareValue.startsWith(compareTarget);

      case RoutingOperator.ENDS_WITH:
        return typeof compareTarget === 'string' && compareValue.endsWith(compareTarget);

      case RoutingOperator.REGEX_MATCH:
        if (targetValue instanceof RegExp) {
          return targetValue.test(compareValue);
        }
        if (typeof targetValue === 'string') {
          const regex = new RegExp(targetValue, condition.caseSensitive === false ? 'i' : '');
          return regex.test(compareValue);
        }
        return false;

      case RoutingOperator.IN:
        return Array.isArray(targetValue) && targetValue.includes(compareValue);

      case RoutingOperator.NOT_IN:
        return Array.isArray(targetValue) && !targetValue.includes(compareValue);

      case RoutingOperator.GREATER_THAN:
        return Number(value) > Number(targetValue);

      case RoutingOperator.LESS_THAN:
        return Number(value) < Number(targetValue);

      default:
        this.logger.warn(`Unknown operator: ${condition.operator}`);
        return false;
    }
  }

  /**
   * Extracts the value from context based on condition type and field
   */
  private extractValue(condition: RoutingCondition, context: RoutingContext): any {
    switch (condition.type) {
      case RoutingConditionType.HEADER:
        return context.request.headers[condition.field.toLowerCase()];

      case RoutingConditionType.QUERY_PARAM:
        return context.request.query[condition.field];

      case RoutingConditionType.BODY_CONTENT:
        return this.extractFromBody(context.request.body, condition.field);

      case RoutingConditionType.PATH_PATTERN:
        return context.request.path;

      case RoutingConditionType.METHOD:
        return context.request.method;

      case RoutingConditionType.CONTENT_TYPE:
        return context.request.headers['content-type'];

      case RoutingConditionType.USER_AGENT:
        return context.request.userAgent || context.request.headers['user-agent'];

      case RoutingConditionType.IP_ADDRESS:
        return context.request.ip;

      case RoutingConditionType.CUSTOM:
        return this.extractCustomValue(condition.field, context);

      default:
        return undefined;
    }
  }

  /**
   * Extracts value from request body using dot notation
   */
  private extractFromBody(body: any, field: string): any {
    if (!body || typeof body !== 'object') {
      return undefined;
    }

    const parts = field.split('.');
    let current = body;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Extracts custom values (tenant, user info, etc.)
   */
  private extractCustomValue(field: string, context: RoutingContext): any {
    const parts = field.split('.');

    if (parts[0] === 'tenant' && context.tenant) {
      return parts.length > 1
        ? context.tenant[parts[1] as keyof typeof context.tenant]
        : context.tenant;
    }

    if (parts[0] === 'user' && context.user) {
      return parts.length > 1 ? context.user[parts[1] as keyof typeof context.user] : context.user;
    }

    if (parts[0] === 'metadata') {
      return parts.length > 1 ? context.metadata[parts[1]] : context.metadata;
    }

    return undefined;
  }

  /**
   * Applies transformations to the request
   */
  private applyTransformations(
    request: RoutingContext['request'],
    transformations?: RoutingTransformation[],
  ): Partial<RoutingContext['request']> {
    if (!transformations || transformations.length === 0) {
      return request;
    }

    const transformed = { ...request };

    for (const transformation of transformations) {
      switch (transformation.type) {
        case 'header':
          this.applyHeaderTransformation(transformed, transformation);
          break;
        case 'query':
          this.applyQueryTransformation(transformed, transformation);
          break;
        case 'path':
          this.applyPathTransformation(transformed, transformation);
          break;
      }
    }

    return transformed;
  }

  private applyHeaderTransformation(request: any, transformation: RoutingTransformation): void {
    switch (transformation.operation) {
      case 'add':
        if (transformation.value) {
          request.headers[transformation.field] = transformation.value;
        }
        break;
      case 'remove':
        delete request.headers[transformation.field];
        break;
      case 'modify':
        if (transformation.value && request.headers[transformation.field]) {
          request.headers[transformation.field] = transformation.value;
        }
        break;
      case 'rename':
        if (transformation.newField && request.headers[transformation.field]) {
          request.headers[transformation.newField] = request.headers[transformation.field];
          delete request.headers[transformation.field];
        }
        break;
    }
  }

  private applyQueryTransformation(request: any, transformation: RoutingTransformation): void {
    switch (transformation.operation) {
      case 'add':
        if (transformation.value) {
          request.query[transformation.field] = transformation.value;
        }
        break;
      case 'remove':
        delete request.query[transformation.field];
        break;
      case 'modify':
        if (transformation.value && request.query[transformation.field]) {
          request.query[transformation.field] = transformation.value;
        }
        break;
      case 'rename':
        if (transformation.newField && request.query[transformation.field]) {
          request.query[transformation.newField] = request.query[transformation.field];
          delete request.query[transformation.field];
        }
        break;
    }
  }

  private applyPathTransformation(request: any, transformation: RoutingTransformation): void {
    if (transformation.operation === 'modify' && transformation.value) {
      request.path = transformation.value;
    }
  }

  /**
   * Generates cache key for routing context
   */
  private generateCacheKey(context: RoutingContext): string {
    const key = {
      method: context.request.method,
      path: context.request.path,
      headers: Object.keys(context.request.headers)
        .sort()
        .reduce(
          (acc, headerKey) => {
            acc[headerKey] = context.request.headers[headerKey];
            return acc;
          },
          {} as Record<string, string>,
        ),
      query: context.request.query,
      tenantId: context.tenant?.id,
      userId: context.user?.id,
    };

    return Buffer.from(JSON.stringify(key)).toString('base64');
  }

  /**
   * Caches routing result with TTL
   */
  private cacheResult(key: string, result: RoutingResult): void {
    if (this.ruleCache.size >= (this.config.cacheConfig?.maxSize || 1000)) {
      // Simple LRU: remove oldest entry
      const firstKey = this.ruleCache.keys().next().value;
      this.ruleCache.delete(firstKey);
    }

    this.ruleCache.set(key, result);

    // Set TTL
    if (this.config.cacheConfig?.ttl) {
      setTimeout(() => {
        this.ruleCache.delete(key);
      }, this.config.cacheConfig.ttl);
    }
  }

  /**
   * Clears the routing cache
   */
  clearCache(): void {
    this.ruleCache.clear();
    this.logger.debug('Routing cache cleared');
  }

  /**
   * Gets current routing statistics
   */
  getStats(): any {
    return {
      rulesCount: this.config.rules.length,
      enabledRulesCount: this.config.rules.filter((r) => r.enabled).length,
      cacheSize: this.ruleCache.size,
      cacheEnabled: this.config.cacheConfig?.enabled || false,
    };
  }
}
