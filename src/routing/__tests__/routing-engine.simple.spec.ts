/**
 * Simple test for routing engine without complex setup
 */

import { RoutingEngineService } from '../services/routing-engine.service';
import {
  RoutingContext,
  RoutingConditionType,
  RoutingOperator,
  RoutingActionType,
  DynamicRoutingConfig
} from '../interfaces/routing.interface';

describe('RoutingEngineService - Simple Tests', () => {
  let service: RoutingEngineService;

  beforeEach(() => {
    service = new RoutingEngineService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

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
        }
      ]
    };

    service.updateConfig(config);
    const stats = service.getStats();

    expect(stats.rulesCount).toBe(1);
    expect(stats.enabledRulesCount).toBe(1);
    expect(stats.cacheEnabled).toBe(true);
  });
});