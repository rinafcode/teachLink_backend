#!/usr/bin/env ts-node

/**
 * Demonstration script for the Content-Based Routing System
 */

import { RoutingEngineService } from '../src/routing/services/routing-engine.service';
import { RoutingConfigService } from '../src/routing/services/routing-config.service';
import {
  RoutingContext,
  RoutingConditionType,
  RoutingOperator,
  RoutingActionType,
  DynamicRoutingConfig
} from '../src/routing/interfaces/routing.interface';

async function demonstrateRouting() {
  console.log('🚀 Content-Based Routing System Demo\n');

  // Initialize services
  const routingEngine = new RoutingEngineService();
  
  // Create demo configuration
  const demoConfig: DynamicRoutingConfig = {
    rules: [
      {
        id: 'api-version-v2',
        name: 'API Version 2 Routing',
        description: 'Route API v2 requests to v2 endpoints',
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
        }
      },
      {
        id: 'mobile-optimization',
        name: 'Mobile Client Optimization',
        description: 'Apply mobile-specific optimizations',
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
            }
          ]
        }
      },
      {
        id: 'admin-access-control',
        name: 'Admin Access Control',
        description: 'Block non-admin access to admin endpoints',
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
        }
      },
      {
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
            }
          ]
        }
      }
    ],
    defaultAction: {
      type: RoutingActionType.FORWARD,
      target: '/api'
    },
    enableLogging: true,
    enableMetrics: true,
    cacheConfig: {
      enabled: true,
      ttl: 300000,
      maxSize: 1000
    }
  };

  // Update routing engine with demo config
  routingEngine.updateConfig(demoConfig);

  console.log('📋 Loaded routing configuration with', demoConfig.rules.length, 'rules\n');

  // Test scenarios
  const testScenarios = [
    {
      name: '🔄 API Version 2 Routing',
      context: {
        request: {
          method: 'GET',
          path: '/users',
          headers: { 'x-api-version': 'v2' },
          query: {},
          ip: '127.0.0.1'
        },
        metadata: { test: true }
      }
    },
    {
      name: '📱 Mobile Client Optimization',
      context: {
        request: {
          method: 'GET',
          path: '/dashboard',
          headers: { 'x-client-type': 'mobile' },
          query: {},
          ip: '127.0.0.1'
        },
        metadata: { test: true }
      }
    },
    {
      name: '🔒 Admin Access Control (Blocked)',
      context: {
        request: {
          method: 'GET',
          path: '/admin/users',
          headers: {},
          query: {},
          ip: '127.0.0.1'
        },
        user: {
          id: 'user-1',
          role: 'USER',
          permissions: []
        },
        metadata: { test: true }
      }
    },
    {
      name: '🔒 Admin Access Control (Allowed)',
      context: {
        request: {
          method: 'GET',
          path: '/admin/users',
          headers: {},
          query: {},
          ip: '127.0.0.1'
        },
        user: {
          id: 'admin-1',
          role: 'ADMIN',
          permissions: ['admin:read', 'admin:write']
        },
        metadata: { test: true }
      }
    },
    {
      name: '🧪 Beta Features Routing',
      context: {
        request: {
          method: 'GET',
          path: '/features',
          headers: {},
          query: { beta: 'true' },
          ip: '127.0.0.1'
        },
        metadata: { test: true }
      }
    },
    {
      name: '🚫 No Rule Match (Default Action)',
      context: {
        request: {
          method: 'GET',
          path: '/regular-endpoint',
          headers: {},
          query: {},
          ip: '127.0.0.1'
        },
        metadata: { test: true }
      }
    }
  ];

  // Run test scenarios
  for (const scenario of testScenarios) {
    console.log(`\n${scenario.name}`);
    console.log('─'.repeat(50));
    
    try {
      const result = await routingEngine.evaluateRouting(scenario.context as RoutingContext);
      
      if (result.matched) {
        console.log('✅ Rule matched:', result.rule?.name);
        console.log('🎯 Action:', result.action?.type);
        console.log('📍 Target:', result.action?.target);
        
        if (result.transformedRequest) {
          console.log('🔄 Transformations applied');
          if (result.transformedRequest.headers) {
            console.log('   Headers:', Object.keys(result.transformedRequest.headers));
          }
        }
        
        if (result.action?.parameters) {
          console.log('⚙️  Parameters:', result.action.parameters);
        }
      } else {
        console.log('❌ No rule matched');
        console.log('🎯 Default action:', demoConfig.defaultAction?.type);
        console.log('📍 Default target:', demoConfig.defaultAction?.target);
      }
    } catch (error) {
      console.log('❌ Error:', error.message);
    }
  }

  // Show statistics
  console.log('\n📊 Routing Statistics');
  console.log('─'.repeat(50));
  const stats = routingEngine.getStats();
  console.log('Total rules:', stats.rulesCount);
  console.log('Enabled rules:', stats.enabledRulesCount);
  console.log('Cache enabled:', stats.cacheEnabled);
  console.log('Cache size:', stats.cacheSize);

  console.log('\n🎉 Demo completed successfully!');
}

// Run the demo
if (require.main === module) {
  demonstrateRouting().catch(console.error);
}

export { demonstrateRouting };