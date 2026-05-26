import { Test, TestingModule } from '@nestjs/testing';
import { RoutingEngineService } from '../services/routing-engine.service';
import {
  RoutingContext,
  RoutingConditionType,
  RoutingOperator,
  RoutingActionType,
  DynamicRoutingConfig
} from '../interfaces/routing.interface';

describe('RoutingEngineService', () => {
  let service: RoutingEngineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RoutingEngineService],
    }).compile();

    service = module.get<RoutingEngineService>(RoutingEngineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('evaluateRouting', () => {
    it('should match header-based routing rule', async () => {
      const config: DynamicRoutingConfig = {
        rules: [
          {
            id: 'test-header-rule',
            name: 'Test Header Rule',
            priority: 100,
            enabled: true,
            conditions: [
              {
                type: RoutingConditionType.HEADER,
                field: 'x-api-version',
                operator: RoutingOperator.EQUALS,
                value: 'v2'
              }
            ],
            action: {
              type: RoutingActionType.FORWARD,
              target: '/api/v2'
            }
          }
        ]
      };

      service.updateConfig(config);

      const context: RoutingContext = {
        request: {
          method: 'GET',
          path: '/api/users',
          headers: { 'x-api-version': 'v2' },
          query: {},
          ip: '127.0.0.1'
        },
        metadata: {}
      };

      const result = await service.evaluateRouting(context);

      expect(result.matched).toBe(true);
      expect(result.rule?.id).toBe('test-header-rule');
      expect(result.action?.type).toBe(RoutingActionType.FORWARD);
      expect(result.action?.target).toBe('/api/v2');
    });

    it('should match query parameter routing rule', async () => {
      const config: DynamicRoutingConfig = {
        rules: [
          {
            id: 'test-query-rule',
            name: 'Test Query Rule',
            priority: 100,
            enabled: true,
            conditions: [
              {
                type: RoutingConditionType.QUERY_PARAM,
                field: 'beta',
                operator: RoutingOperator.EQUALS,
                value: 'true'
              }
            ],
            action: {
              type: RoutingActionType.FORWARD,
              target: '/api/beta'
            }
          }
        ]
      };

      service.updateConfig(config);

      const context: RoutingContext = {
        request: {
          method: 'GET',
          path: '/api/users',
          headers: {},
          query: { beta: 'true' },
          ip: '127.0.0.1'
        },
        metadata: {}
      };

      const result = await service.evaluateRouting(context);

      expect(result.matched).toBe(true);
      expect(result.rule?.id).toBe('test-query-rule');
    });

    it('should match path pattern routing rule', async () => {
      const config: DynamicRoutingConfig = {
        rules: [
          {
            id: 'test-path-rule',
            name: 'Test Path Rule',
            priority: 100,
            enabled: true,
            conditions: [
              {
                type: RoutingConditionType.PATH_PATTERN,
                field: 'path',
                operator: RoutingOperator.STARTS_WITH,
                value: '/admin'
              }
            ],
            action: {
              type: RoutingActionType.BLOCK,
              target: 'unauthorized'
            }
          }
        ]
      };

      service.updateConfig(config);

      const context: RoutingContext = {
        request: {
          method: 'GET',
          path: '/admin/users',
          headers: {},
          query: {},
          ip: '127.0.0.1'
        },
        metadata: {}
      };

      const result = await service.evaluateRouting(context);

      expect(result.matched).toBe(true);
      expect(result.action?.type).toBe(RoutingActionType.BLOCK);
    });

    it('should match custom user role condition', async () => {
      const config: DynamicRoutingConfig = {
        rules: [
          {
            id: 'test-user-rule',
            name: 'Test User Rule',
            priority: 100,
            enabled: true,
            conditions: [
              {
                type: RoutingConditionType.CUSTOM,
                field: 'user.role',
                operator: RoutingOperator.EQUALS,
                value: 'ADMIN'
              }
            ],
            action: {
              type: RoutingActionType.FORWARD,
              target: '/admin'
            }
          }
        ]
      };

      service.updateConfig(config);

      const context: RoutingContext = {
        request: {
          method: 'GET',
          path: '/dashboard',
          headers: {},
          query: {},
          ip: '127.0.0.1'
        },
        user: {
          id: 'user-1',
          role: 'ADMIN',
          permissions: []
        },
        metadata: {}
      };

      const result = await service.evaluateRouting(context);

      expect(result.matched).toBe(true);
      expect(result.action?.target).toBe('/admin');
    });

    it('should not match when conditions are not met', async () => {
      const config: DynamicRoutingConfig = {
        rules: [
          {
            id: 'test-no-match-rule',
            name: 'Test No Match Rule',
            priority: 100,
            enabled: true,
            conditions: [
              {
                type: RoutingConditionType.HEADER,
                field: 'x-api-version',
                operator: RoutingOperator.EQUALS,
                value: 'v3'
              }
            ],
            action: {
              type: RoutingActionType.FORWARD,
              target: '/api/v3'
            }
          }
        ]
      };

      service.updateConfig(config);

      const context: RoutingContext = {
        request: {
          method: 'GET',
          path: '/api/users',
          headers: { 'x-api-version': 'v2' },
          query: {},
          ip: '127.0.0.1'
        },
        metadata: {}
      };

      const result = await service.evaluateRouting(context);

      expect(result.matched).toBe(false);
      expect(result.rule).toBeUndefined();
    });

    it('should respect rule priority', async () => {
      const config: DynamicRoutingConfig = {
        rules: [
          {
            id: 'low-priority-rule',
            name: 'Low Priority Rule',
            priority: 50,
            enabled: true,
            conditions: [
              {
                type: RoutingConditionType.PATH_PATTERN,
                field: 'path',
                operator: RoutingOperator.STARTS_WITH,
                value: '/api'
              }
            ],
            action: {
              type: RoutingActionType.FORWARD,
              target: '/api/v1'
            }
          },
          {
            id: 'high-priority-rule',
            name: 'High Priority Rule',
            priority: 100,
            enabled: true,
            conditions: [
              {
                type: RoutingConditionType.PATH_PATTERN,
                field: 'path',
                operator: RoutingOperator.STARTS_WITH,
                value: '/api'
              }
            ],
            action: {
              type: RoutingActionType.FORWARD,
              target: '/api/v2'
            }
          }
        ]
      };

      service.updateConfig(config);

      const context: RoutingContext = {
        request: {
          method: 'GET',
          path: '/api/users',
          headers: {},
          query: {},
          ip: '127.0.0.1'
        },
        metadata: {}
      };

      const result = await service.evaluateRouting(context);

      expect(result.matched).toBe(true);
      expect(result.rule?.id).toBe('high-priority-rule');
      expect(result.action?.target).toBe('/api/v2');
    });

    it('should skip disabled rules', async () => {
      const config: DynamicRoutingConfig = {
        rules: [
          {
            id: 'disabled-rule',
            name: 'Disabled Rule',
            priority: 100,
            enabled: false,
            conditions: [
              {
                type: RoutingConditionType.PATH_PATTERN,
                field: 'path',
                operator: RoutingOperator.STARTS_WITH,
                value: '/api'
              }
            ],
            action: {
              type: RoutingActionType.BLOCK,
              target: 'blocked'
            }
          }
        ]
      };

      service.updateConfig(config);

      const context: RoutingContext = {
        request: {
          method: 'GET',
          path: '/api/users',
          headers: {},
          query: {},
          ip: '127.0.0.1'
        },
        metadata: {}
      };

      const result = await service.evaluateRouting(context);

      expect(result.matched).toBe(false);
    });

    it('should apply transformations', async () => {
      const config: DynamicRoutingConfig = {
        rules: [
          {
            id: 'transformation-rule',
            name: 'Transformation Rule',
            priority: 100,
            enabled: true,
            conditions: [
              {
                type: RoutingConditionType.HEADER,
                field: 'x-client-type',
                operator: RoutingOperator.EQUALS,
                value: 'mobile'
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
          }
        ]
      };

      service.updateConfig(config);

      const context: RoutingContext = {
        request: {
          method: 'GET',
          path: '/api/users',
          headers: { 'x-client-type': 'mobile' },
          query: {},
          ip: '127.0.0.1'
        },
        metadata: {}
      };

      const result = await service.evaluateRouting(context);

      expect(result.matched).toBe(true);
      expect(result.transformedRequest?.headers?.['x-mobile-optimized']).toBe('true');
    });
  });

  describe('getStats', () => {
    it('should return routing statistics', () => {
      const config: DynamicRoutingConfig = {
        rules: [
          {
            id: 'rule-1',
            name: 'Rule 1',
            priority: 100,
            enabled: true,
            conditions: [],
            action: { type: RoutingActionType.FORWARD, target: '/test' }
          },
          {
            id: 'rule-2',
            name: 'Rule 2',
            priority: 50,
            enabled: false,
            conditions: [],
            action: { type: RoutingActionType.BLOCK, target: 'blocked' }
          }
        ]
      };

      service.updateConfig(config);

      const stats = service.getStats();

      expect(stats.rulesCount).toBe(2);
      expect(stats.enabledRulesCount).toBe(1);
      expect(stats.cacheEnabled).toBe(true);
    });
  });

  describe('clearCache', () => {
    it('should clear the routing cache', () => {
      service.clearCache();
      // No assertion needed, just ensure it doesn't throw
      expect(true).toBe(true);
    });
  });
});