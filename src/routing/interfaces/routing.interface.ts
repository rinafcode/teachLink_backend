/**
 * Routing configuration interfaces for content-based routing
 */

export interface RoutingRule {
  id: string;
  name: string;
  description?: string;
  priority: number;
  enabled: boolean;
  conditions: RoutingCondition[];
  action: RoutingAction;
  metadata?: Record<string, any>;
}

export interface RoutingCondition {
  type: RoutingConditionType;
  field: string;
  operator: RoutingOperator;
  value: string | string[] | RegExp;
  caseSensitive?: boolean;
}

export enum RoutingConditionType {
  HEADER = 'header',
  QUERY_PARAM = 'query_param',
  BODY_CONTENT = 'body_content',
  PATH_PATTERN = 'path_pattern',
  METHOD = 'method',
  CONTENT_TYPE = 'content_type',
  USER_AGENT = 'user_agent',
  IP_ADDRESS = 'ip_address',
  CUSTOM = 'custom',
}

export enum RoutingOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  REGEX_MATCH = 'regex_match',
  IN = 'in',
  NOT_IN = 'not_in',
  EXISTS = 'exists',
  NOT_EXISTS = 'not_exists',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
}

export interface RoutingAction {
  type: RoutingActionType;
  target: string;
  parameters?: Record<string, any>;
  transformations?: RoutingTransformation[];
}

export enum RoutingActionType {
  FORWARD = 'forward',
  REDIRECT = 'redirect',
  REWRITE = 'rewrite',
  BLOCK = 'block',
  RATE_LIMIT = 'rate_limit',
  CACHE = 'cache',
  TRANSFORM = 'transform',
  CUSTOM_HANDLER = 'custom_handler',
}

export interface RoutingTransformation {
  type: 'header' | 'query' | 'body' | 'path';
  operation: 'add' | 'remove' | 'modify' | 'rename';
  field: string;
  value?: string;
  newField?: string;
}

export interface RoutingContext {
  request: {
    method: string;
    path: string;
    headers: Record<string, string>;
    query: Record<string, any>;
    body?: any;
    ip: string;
    userAgent?: string;
  };
  tenant?: {
    id: string;
    slug: string;
    domain: string;
  };
  user?: {
    id: string;
    role: string;
    permissions: string[];
  };
  metadata: Record<string, any>;
}

export interface RoutingResult {
  matched: boolean;
  rule?: RoutingRule;
  action?: RoutingAction;
  transformedRequest?: Partial<RoutingContext['request']>;
  metadata?: Record<string, any>;
}

export interface DynamicRoutingConfig {
  rules: RoutingRule[];
  defaultAction?: RoutingAction;
  enableLogging?: boolean;
  enableMetrics?: boolean;
  cacheConfig?: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
}
