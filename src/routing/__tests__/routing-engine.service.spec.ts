import { Test, TestingModule } from '@nestjs/testing';
import { RoutingEngineService } from '../services/routing-engine.service';
import {
  RoutingContext,
  RoutingConditionType,
  RoutingOperator,
  RoutingActionType,
  DynamicRoutingConfig,
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
    it('should return no match when no rules are configured', async () => {
      const context: RoutingContext = {
        request: {
          method: 'GET',
          path: '/api/test',
          headers: {},
          query: {},
          ip: '127.0.0.1',
        },
        metadata: {},
      };

      const result = await service.evaluateRouting(context);

      expect(result.matched).toBe(false);
      expect(result.rule).toBeUndefined();
    });

    it('should match header-based routing rule', async () => {
      const config: DynamicRoutingConfig = {
        rules: [
          {
            id: 'test-rule',
            name: 'Test Rule',
            priority: 100,
            enabled: true,
            conditions: [
              {
                type: RoutingConditionType.HEADER,
                field: 'x-api-version',
                operator: RoutingOperator.EQUALS,
                value: 'v2',
              },
            ],
            action: {
              type: RoutingActionType.FORWARD,
              target: '/api/v2',
            },
          },
        ],
      };

      service.updateConfig(config);

      const context: RoutingContext = {
        request: {
          method: 'GET',
          path: '/api/test',
          headers: { 'x-api-version': 'v2' },
          query: {},
          ip: '127.0.0.1',
        },
        metadata: {},
      };

      const result = await service.evaluateRouting(context);

      expect(result.matched).toBe(true);
      expect(result.rule?.id).toBe('test-rule');
      expect(result.action?.type).toBe(RoutingActionType.FORWARD);
    });

    it('should match query parameter routing rule', async () => {
      const config: DynamicRoutingConfig = {
        rules: [
          {
            id: 'beta-rule',
            name: 'Beta Feature Rule',
            priority: 90,
            enabled: true,
            conditions: [
              {
                type: RoutingConditionType.QUERY_PARAM,
                field: 'beta',
                operator: RoutingOperator.EQUALS,
                value: 'true',
              },
            ],
            action: {
              type: RoutingActionType.FORWARD,
              target: '/api/beta',
            },
          },
        ],
      };

      service.updateConfig(config);

      const context: RoutingContext = {
        request: {
          method: 'GET',
          path: '/api/test',
          headers: {},
          query: { beta: 'true' },
          ip: '127.0.0.1',
        },
        metadata: {},
      };

      const result = await service.evaluateRouting(context);

      expect(result.matched).toBe(true);
      expect(result.rule?.id).toBe('beta-rule');
    });

    it('should match path pattern routing rule', async () => {
      const config: DynamicRoutingConfig = {
        rules: [
          {
            id: 'admin-rule',
            name: 'Admin Rule',
            priority: 200,
            enabled: true,
            conditions: [
              {
                type: RoutingConditionType.PATH_PATTERN,
                field: 'path',
                operator: RoutingOperator.STARTS_WITH,
                value: '/admin',
              },
            ],
            action: {
              type: RoutingActionType.BLOCK,
              target: 'unauthorized',
            },
          },
        ],
      };

      service.updateConfig(config);

      const context: RoutingContext = {
        request: {
          method: 'GET',
          path: '/admin/users',
          headers: {},
          query: {},
          ip: '127.0.0.1',
        },
        metadata: {},
      };

      const result = await service.evaluateRouting(context);

      expect(result.matched).toBe(true);
      expect(result.rule?.id).toBe('admin-rule');
      expect(result.action?.type).toBe(RoutingActionType.BLOCK);
    });

    it('should respect rule priority order', async () => {
      const config: DynamicRoutingConfig = {
        rules: [
          {
            id: 'low-priority',
            name: 'Low Priority Rule',
            priority: 50,
            enabled: true,
            conditions: [
              {
                type: RoutingConditionType.PATH_PATTERN,
                field: 'path',
                operator: RoutingOperator.STARTS_WITH,
                value: '/api',
              },
            ],
            action: {
              type: RoutingActionType.FORWARD,
              target: '/api/v1',
            },
          },
          {
            id: 'high-priority',
            name: 'High Priority Rule',
            priority: 100,
            enabled: true,
            conditions: [
              {
                type: RoutingConditionType.PATH_PATTERN,
                field: 'path',
                operator: RoutingOperator.STARTS_WITH,
                value: '/api',
              },
            ],
            action: {
              type: RoutingActionType.FORWARD,
              target: '/api/v2',
            },
          },
        ],
      };

      service.updateConfig(config);

      const context: RoutingContext = {
        request: {
          method: 'GET',
          path: '/api/test',
          headers: {},
          query: {},
          ip: '127.0.0.1',
        },
        metadata: {},
      };

      const result = await service.evaluateRouting(context);

      expect(result.matched).toBe(true);
      expect(result.rule?.id).toBe('high-priority');
      expect(result.action?.target).toBe('/api/v2');
    });

    it('should not match disabled rules', async () => {
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
                value: '/api',
              },
            ],
            action: {
              type: RoutingActionType.FORWARD,
              target: '/api/v2',
            },
          },
        ],
      };

      service.updateConfig(config);

      const context: RoutingContext = {
        request: {
          method: 'GET',
          path: '/api/test',
          headers: {},
          query: {},
          ip: '127.0.0.1',
        },
        metadata: {},
      };

      const result = await service.evaluateRouting(context);

      expect(result.matched).toBe(false);
    });

    it('should handle regex matching', async () => {
      const config: DynamicRoutingConfig = {
        rules: [
          {
            id: 'regex-rule',
            name: 'Regex Rule',
            priority: 100,
            enabled: true,
            conditions: [
              {
                type: RoutingConditionType.PATH_PATTERN,
                field: 'path',
                operator: RoutingOperator.REGEX_MATCH,
                value: '\\.css$',
              },
            ],
            action: {
              type: RoutingActionType.CACHE,
              target: 'static-assets',
            },
          },
        ],
      };

      service.updateConfig(config);

      const context: RoutingContext = {
        request: {
          method: 'GET',
          path: '/assets/style.css',
          headers: {},
          query: {},
          ip: '127.0.0.1',
        },
        metadata: {},
      };

      const result = await service.evaluateRouting(context);

      expect(result.matched).toBe(true);
      expect(result.rule?.id).toBe('regex-rule');
    });
  });

  describe('clearCache', () => {
    it('should clear the routing cache', () => {
      expect(() => service.clearCache()).not.toThrow();
    });
  });

  describe('getStats', () => {
    it('should return routing statistics', () => {
      const stats = service.getStats();

      expect(stats).toHaveProperty('rulesCount');
      expect(stats).toHaveProperty('enabledRulesCount');
      expect(stats).toHaveProperty('cacheSize');
      expect(stats).toHaveProperty('cacheEnabled');
    });
  });
});
