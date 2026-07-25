import {
  RoutingCondition,
  RoutingConditionType,
  RoutingOperator,
} from '../interfaces/routing.interface';

/**
 * Utility functions for creating routing conditions and rules
 */

/**
 * Creates a header-based routing condition
 */
export function createHeaderCondition(
  headerName: string,
  operator: RoutingOperator,
  value: string | string[],
  caseSensitive = false,
): RoutingCondition {
  return {
    type: RoutingConditionType.HEADER,
    field: headerName.toLowerCase(),
    operator,
    value,
    caseSensitive,
  };
}

/**
 * Creates a query parameter routing condition
 */
export function createQueryCondition(
  paramName: string,
  operator: RoutingOperator,
  value: string | string[],
  caseSensitive = false,
): RoutingCondition {
  return {
    type: RoutingConditionType.QUERY_PARAM,
    field: paramName,
    operator,
    value,
    caseSensitive,
  };
}

/**
 * Creates a path pattern routing condition
 */
export function createPathCondition(
  operator: RoutingOperator,
  pattern: string | RegExp,
  caseSensitive = false,
): RoutingCondition {
  return {
    type: RoutingConditionType.PATH_PATTERN,
    field: 'path',
    operator,
    value: pattern,
    caseSensitive,
  };
}

/**
 * Creates a body content routing condition
 */
export function createBodyCondition(
  fieldPath: string,
  operator: RoutingOperator,
  value: string | string[],
  caseSensitive = false,
): RoutingCondition {
  return {
    type: RoutingConditionType.BODY_CONTENT,
    field: fieldPath,
    operator,
    value,
    caseSensitive,
  };
}

/**
 * Creates a user-based routing condition
 */
export function createUserCondition(
  userField: string,
  operator: RoutingOperator,
  value: string | string[],
  caseSensitive = false,
): RoutingCondition {
  return {
    type: RoutingConditionType.CUSTOM,
    field: `user.${userField}`,
    operator,
    value,
    caseSensitive,
  };
}

/**
 * Creates a tenant-based routing condition
 */
export function createTenantCondition(
  tenantField: string,
  operator: RoutingOperator,
  value: string | string[],
  caseSensitive = false,
): RoutingCondition {
  return {
    type: RoutingConditionType.CUSTOM,
    field: `tenant.${tenantField}`,
    operator,
    value,
    caseSensitive,
  };
}

/**
 * Common routing condition presets
 */
export const RoutingPresets = {
  /**
   * API version routing conditions
   */
  apiVersion: {
    v1: () => createHeaderCondition('x-api-version', RoutingOperator.EQUALS, 'v1'),
    v2: () => createHeaderCondition('x-api-version', RoutingOperator.EQUALS, 'v2'),
    latest: () => createHeaderCondition('x-api-version', RoutingOperator.IN, ['v2', 'latest']),
  },

  /**
   * Client type routing conditions
   */
  clientType: {
    mobile: () => createHeaderCondition('x-client-type', RoutingOperator.EQUALS, 'mobile'),
    web: () => createHeaderCondition('x-client-type', RoutingOperator.EQUALS, 'web'),
    api: () => createHeaderCondition('x-client-type', RoutingOperator.EQUALS, 'api'),
  },

  /**
   * User role routing conditions
   */
  userRole: {
    admin: () => createUserCondition('role', RoutingOperator.EQUALS, 'ADMIN'),
    user: () => createUserCondition('role', RoutingOperator.EQUALS, 'USER'),
    guest: () => createUserCondition('role', RoutingOperator.EQUALS, 'GUEST'),
    notAdmin: () => createUserCondition('role', RoutingOperator.NOT_EQUALS, 'ADMIN'),
  },

  /**
   * Path-based routing conditions
   */
  paths: {
    admin: () => createPathCondition(RoutingOperator.STARTS_WITH, '/admin'),
    api: () => createPathCondition(RoutingOperator.STARTS_WITH, '/api'),
    static: () =>
      createPathCondition(RoutingOperator.REGEX_MATCH, '\\.(css|js|png|jpg|jpeg|gif|ico|svg)$'),
    upload: () => createPathCondition(RoutingOperator.CONTAINS, '/upload'),
  },

  /**
   * Content type routing conditions
   */
  contentType: {
    json: () => createHeaderCondition('content-type', RoutingOperator.CONTAINS, 'application/json'),
    xml: () => createHeaderCondition('content-type', RoutingOperator.CONTAINS, 'application/xml'),
    formData: () =>
      createHeaderCondition('content-type', RoutingOperator.CONTAINS, 'multipart/form-data'),
    urlEncoded: () =>
      createHeaderCondition(
        'content-type',
        RoutingOperator.CONTAINS,
        'application/x-www-form-urlencoded',
      ),
  },

  /**
   * Feature flag routing conditions
   */
  featureFlags: {
    beta: () => createQueryCondition('beta', RoutingOperator.EQUALS, 'true'),
    experimental: () => createQueryCondition('experimental', RoutingOperator.EQUALS, 'true'),
    preview: () => createHeaderCondition('x-preview-features', RoutingOperator.EQUALS, 'enabled'),
  },

  /**
   * Tenant routing conditions
   */
  tenant: {
    byId: (tenantId: string) => createTenantCondition('id', RoutingOperator.EQUALS, tenantId),
    bySlug: (slug: string) => createTenantCondition('slug', RoutingOperator.EQUALS, slug),
    byDomain: (domain: string) => createTenantCondition('domain', RoutingOperator.EQUALS, domain),
    subdomainPattern: () =>
      createHeaderCondition('host', RoutingOperator.REGEX_MATCH, '^([^.]+)\\.teachlink\\.'),
  },
};

/**
 * Validates a routing condition
 */
export function validateCondition(condition: RoutingCondition): string[] {
  const errors: string[] = [];

  if (!condition.type) {
    errors.push('Condition type is required');
  }

  if (!condition.field) {
    errors.push('Condition field is required');
  }

  if (!condition.operator) {
    errors.push('Condition operator is required');
  }

  if (condition.value === undefined || condition.value === null) {
    if (
      condition.operator !== RoutingOperator.EXISTS &&
      condition.operator !== RoutingOperator.NOT_EXISTS
    ) {
      errors.push('Condition value is required for this operator');
    }
  }

  // Validate operator compatibility with value type
  if (Array.isArray(condition.value)) {
    if (![RoutingOperator.IN, RoutingOperator.NOT_IN].includes(condition.operator)) {
      errors.push('Array values can only be used with IN or NOT_IN operators');
    }
  }

  if (condition.value instanceof RegExp) {
    if (condition.operator !== RoutingOperator.REGEX_MATCH) {
      errors.push('RegExp values can only be used with REGEX_MATCH operator');
    }
  }

  return errors;
}

/**
 * Normalizes a routing condition for consistent processing
 */
export function normalizeCondition(condition: RoutingCondition): RoutingCondition {
  const normalized = { ...condition };

  // Normalize field names
  if (condition.type === RoutingConditionType.HEADER) {
    normalized.field = condition.field.toLowerCase();
  }

  // Set default case sensitivity
  if (normalized.caseSensitive === undefined) {
    normalized.caseSensitive = false;
  }

  return normalized;
}

/**
 * Creates a compound condition (multiple conditions with AND logic)
 */
export function createCompoundCondition(...conditions: RoutingCondition[]): RoutingCondition[] {
  return conditions.map(normalizeCondition);
}

/**
 * Utility for creating common routing patterns
 */
export const CommonPatterns = {
  /**
   * API versioning pattern
   */
  apiVersioning: (version: string, targetPath: string) => ({
    conditions: [RoutingPresets.apiVersion.v2()],
    action: {
      type: 'rewrite' as const,
      target: targetPath,
      transformations: [
        {
          type: 'header' as const,
          operation: 'add' as const,
          field: 'x-api-version-routed',
          value: version,
        },
      ],
    },
  }),

  /**
   * Admin access control pattern
   */
  adminOnly: (blockMessage = 'Admin access required') => ({
    conditions: [RoutingPresets.paths.admin(), RoutingPresets.userRole.notAdmin()],
    action: {
      type: 'block' as const,
      target: 'unauthorized',
      parameters: {
        statusCode: 403,
        message: blockMessage,
      },
    },
  }),

  /**
   * Mobile optimization pattern
   */
  mobileOptimization: (targetPath: string) => ({
    conditions: [RoutingPresets.clientType.mobile()],
    action: {
      type: 'forward' as const,
      target: targetPath,
      transformations: [
        {
          type: 'header' as const,
          operation: 'add' as const,
          field: 'x-mobile-optimized',
          value: 'true',
        },
      ],
    },
  }),

  /**
   * Static asset caching pattern
   */
  staticCaching: (maxAge = 86400) => ({
    conditions: [RoutingPresets.paths.static()],
    action: {
      type: 'cache' as const,
      target: 'static-assets',
      parameters: {
        maxAge,
        cacheControl: `public, max-age=${maxAge}, immutable`,
      },
    },
  }),
};
