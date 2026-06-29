/**
 * Examples of how to use the Content-Based Routing System
 */

import { RoutingRule, RoutingConditionType, RoutingOperator, RoutingActionType } from '../src/routing/interfaces/routing.interface';
import { RoutingPresets, CommonPatterns } from '../src/routing/utils/routing-helpers';

// Example 1: API Version Routing
export const apiVersionRoutingRule: RoutingRule = {
  id: 'api-version-v2',
  name: 'API Version 2 Routing',
  description: 'Route API v2 requests to the v2 endpoints',
  priority: 100,
  enabled: true,
  conditions: [
    {
      type: RoutingConditionType.HEADER,
      field: 'x-api-version',
      operator: RoutingOperator.EQUALS,
      value: 'v2',
      caseSensitive: false
    }
  ],
  action: {
    type: RoutingActionType.REWRITE,
    target: '/api/v2${originalPath}',
    transformations: [
      {
        type: 'header',
        operation: 'add',
        field: 'x-routed-by',
        value: 'content-router'
      }
    ]
  },
  metadata: {
    category: 'api-versioning',
    createdBy: 'system'
  }
};

// Example 2: Mobile Client Optimization
export const mobileOptimizationRule: RoutingRule = {
  id: 'mobile-optimization',
  name: 'Mobile Client Optimization',
  description: 'Apply mobile-specific optimizations and routing',
  priority: 90,
  enabled: true,
  conditions: [
    {
      type: RoutingConditionType.HEADER,
      field: 'x-client-type',
      operator: RoutingOperator.EQUALS,
      value: 'mobile',
      caseSensitive: false
    }
  ],
  action: {
    type: RoutingActionType.FORWARD,
    target: '/api/mobile',
    transformations: [
      {
        type: 'header',
        operation: 'add',
        field: 'x-mobile-optimized',
        value: 'true'
      },
      {
        type: 'header',
        operation: 'add',
        field: 'x-response-format',
        value: 'compact'
      }
    ]
  }
};

// Example 3: Admin Access Control
export const adminAccessControlRule: RoutingRule = {
  id: 'admin-access-control',
  name: 'Admin Access Control',
  description: 'Block non-admin users from accessing admin endpoints',
  priority: 200,
  enabled: true,
  conditions: [
    {
      type: RoutingConditionType.PATH_PATTERN,
      field: 'path',
      operator: RoutingOperator.STARTS_WITH,
      value: '/admin'
    },
    {
      type: RoutingConditionType.CUSTOM,
      field: 'user.role',
      operator: RoutingOperator.NOT_EQUALS,
      value: 'ADMIN'
    }
  ],
  action: {
    type: RoutingActionType.BLOCK,
    target: 'unauthorized',
    parameters: {
      statusCode: 403,
      message: 'Admin access required'
    }
  },
  metadata: {
    category: 'security',
    critical: true
  }
};

// Example 4: Feature Flag Routing
export const betaFeaturesRule: RoutingRule = {
  id: 'beta-features',
  name: 'Beta Features Routing',
  description: 'Route users to beta features when enabled',
  priority: 80,
  enabled: true,
  conditions: [
    {
      type: RoutingConditionType.QUERY_PARAM,
      field: 'beta',
      operator: RoutingOperator.EQUALS,
      value: 'true',
      caseSensitive: false
    }
  ],
  action: {
    type: RoutingActionType.FORWARD,
    target: '/api/beta',
    transformations: [
      {
        type: 'header',
        operation: 'add',
        field: 'x-beta-features',
        value: 'enabled'
      },
      {
        type: 'query',
        operation: 'remove',
        field: 'beta'
      }
    ]
  }
};

// Example 5: Tenant Subdomain Routing
export const tenantSubdomainRule: RoutingRule = {
  id: 'tenant-subdomain',
  name: 'Tenant Subdomain Routing',
  description: 'Route requests based on tenant subdomain',
  priority: 85,
  enabled: true,
  conditions: [
    {
      type: RoutingConditionType.HEADER,
      field: 'host',
      operator: RoutingOperator.REGEX_MATCH,
      value: '^([^.]+)\\.teachlink\\.',
      caseSensitive: false
    }
  ],
  action: {
    type: RoutingActionType.FORWARD,
    target: '/tenant',
    transformations: [
      {
        type: 'header',
        operation: 'add',
        field: 'x-tenant-from-subdomain',
        value: 'true'
      }
    ]
  }
};

// Example 6: Content Type Based Routing
export const contentTypeRoutingRule: RoutingRule = {
  id: 'json-upload-routing',
  name: 'JSON Upload Routing',
  description: 'Route JSON uploads to specialized handler',
  priority: 70,
  enabled: true,
  conditions: [
    {
      type: RoutingConditionType.CONTENT_TYPE,
      field: 'content-type',
      operator: RoutingOperator.CONTAINS,
      value: 'application/json',
      caseSensitive: false
    },
    {
      type: RoutingConditionType.PATH_PATTERN,
      field: 'path',
      operator: RoutingOperator.STARTS_WITH,
      value: '/api/upload'
    }
  ],
  action: {
    type: RoutingActionType.FORWARD,
    target: '/api/upload/json',
    transformations: [
      {
        type: 'header',
        operation: 'add',
        field: 'x-upload-type',
        value: 'json'
      }
    ]
  }
};

// Example 7: Rate Limiting by User Type
export const rateLimitingRule: RoutingRule = {
  id: 'free-user-rate-limit',
  name: 'Free User Rate Limiting',
  description: 'Apply stricter rate limits to free users',
  priority: 60,
  enabled: true,
  conditions: [
    {
      type: RoutingConditionType.CUSTOM,
      field: 'user.plan',
      operator: RoutingOperator.EQUALS,
      value: 'free'
    }
  ],
  action: {
    type: RoutingActionType.RATE_LIMIT,
    target: 'free-tier',
    parameters: {
      limit: 100,
      window: 3600000, // 1 hour
      message: 'Free tier rate limit exceeded'
    }
  }
};

// Example 8: Static Asset Caching
export const staticAssetCachingRule: RoutingRule = {
  id: 'static-asset-caching',
  name: 'Static Asset Caching',
  description: 'Apply long-term caching to static assets',
  priority: 40,
  enabled: true,
  conditions: [
    {
      type: RoutingConditionType.PATH_PATTERN,
      field: 'path',
      operator: RoutingOperator.REGEX_MATCH,
      value: '\\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2)$',
      caseSensitive: false
    }
  ],
  action: {
    type: RoutingActionType.CACHE,
    target: 'static-assets',
    parameters: {
      maxAge: 86400, // 24 hours
      cacheControl: 'public, max-age=86400, immutable'
    }
  }
};

// Example 9: A/B Testing Routing
export const abTestingRule: RoutingRule = {
  id: 'ab-test-checkout',
  name: 'A/B Test Checkout Flow',
  description: 'Route users to different checkout flows for A/B testing',
  priority: 75,
  enabled: true,
  conditions: [
    {
      type: RoutingConditionType.PATH_PATTERN,
      field: 'path',
      operator: RoutingOperator.EQUALS,
      value: '/checkout'
    },
    {
      type: RoutingConditionType.HEADER,
      field: 'x-ab-test-group',
      operator: RoutingOperator.EQUALS,
      value: 'variant-b'
    }
  ],
  action: {
    type: RoutingActionType.FORWARD,
    target: '/checkout/variant-b',
    transformations: [
      {
        type: 'header',
        operation: 'add',
        field: 'x-ab-test-active',
        value: 'checkout-flow-b'
      }
    ]
  }
};

// Example 10: Geographic Routing
export const geographicRoutingRule: RoutingRule = {
  id: 'eu-data-routing',
  name: 'EU Data Routing',
  description: 'Route EU users to EU-compliant endpoints',
  priority: 95,
  enabled: true,
  conditions: [
    {
      type: RoutingConditionType.HEADER,
      field: 'x-user-region',
      operator: RoutingOperator.IN,
      value: ['EU', 'GDPR']
    }
  ],
  action: {
    type: RoutingActionType.FORWARD,
    target: '/api/eu',
    transformations: [
      {
        type: 'header',
        operation: 'add',
        field: 'x-gdpr-compliant',
        value: 'true'
      }
    ]
  }
};

// Using Routing Presets (Simplified Creation)
export const presetExamples = {
  // API Version routing using presets
  apiV2: {
    id: 'api-v2-preset',
    name: 'API V2 Preset',
    priority: 100,
    enabled: true,
    conditions: [RoutingPresets.apiVersion.v2()],
    action: {
      type: RoutingActionType.REWRITE,
      target: '/api/v2${originalPath}'
    }
  },

  // Mobile optimization using presets
  mobile: {
    id: 'mobile-preset',
    name: 'Mobile Preset',
    priority: 90,
    enabled: true,
    conditions: [RoutingPresets.clientType.mobile()],
    action: {
      type: RoutingActionType.FORWARD,
      target: '/api/mobile'
    }
  },

  // Admin access control using presets
  adminOnly: {
    id: 'admin-preset',
    name: 'Admin Only Preset',
    priority: 200,
    enabled: true,
    conditions: [
      RoutingPresets.paths.admin(),
      RoutingPresets.userRole.notAdmin()
    ],
    action: {
      type: RoutingActionType.BLOCK,
      target: 'unauthorized'
    }
  }
};

// Using Common Patterns (Even Simpler)
export const patternExamples = {
  // API versioning pattern
  apiVersioning: CommonPatterns.apiVersioning('v2', '/api/v2'),
  
  // Admin access control pattern
  adminAccess: CommonPatterns.adminOnly('Admin access required'),
  
  // Mobile optimization pattern
  mobileOpt: CommonPatterns.mobileOptimization('/api/mobile'),
  
  // Static asset caching pattern
  staticCache: CommonPatterns.staticCaching(86400)
};

// Complete routing configuration example
export const exampleRoutingConfig = {
  rules: [
    adminAccessControlRule,
    apiVersionRoutingRule,
    geographicRoutingRule,
    mobileOptimizationRule,
    tenantSubdomainRule,
    betaFeaturesRule,
    abTestingRule,
    contentTypeRoutingRule,
    rateLimitingRule,
    staticAssetCachingRule
  ],
  defaultAction: {
    type: RoutingActionType.FORWARD,
    target: '/api'
  },
  enableLogging: true,
  enableMetrics: true,
  cacheConfig: {
    enabled: true,
    ttl: 300000, // 5 minutes
    maxSize: 1000
  }
};

// Example of how to test routing rules
export const testRoutingExamples = {
  // Test API version routing
  testApiV2: {
    method: 'GET',
    path: '/users',
    headers: {
      'x-api-version': 'v2'
    },
    expectedResult: {
      matched: true,
      action: {
        type: 'rewrite',
        target: '/api/v2/users'
      }
    }
  },

  // Test mobile routing
  testMobile: {
    method: 'GET',
    path: '/dashboard',
    headers: {
      'x-client-type': 'mobile'
    },
    expectedResult: {
      matched: true,
      action: {
        type: 'forward',
        target: '/api/mobile'
      }
    }
  },

  // Test admin access control
  testAdminBlock: {
    method: 'GET',
    path: '/admin/users',
    user: {
      id: 'user-1',
      role: 'USER'
    },
    expectedResult: {
      matched: true,
      action: {
        type: 'block',
        target: 'unauthorized'
      }
    }
  },

  // Test beta features
  testBetaFeatures: {
    method: 'GET',
    path: '/features',
    query: {
      beta: 'true'
    },
    expectedResult: {
      matched: true,
      action: {
        type: 'forward',
        target: '/api/beta'
      }
    }
  }
};