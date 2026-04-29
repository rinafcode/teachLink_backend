import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ShardRouter } from '../router/shard.router';

/**
 * Extract shard key from request or context
 */
export function extractShardKey(
  data: any,
  context?: ExecutionContext,
  defaultValue?: string,
): string {
  if (typeof data === 'string') {
    return data;
  }

  if (typeof data === 'object' && data !== null) {
    // Check common shard key fields
    const possibleKeys = ['shardKey', 'tenantId', 'userId', 'id', 'businessId'];
    for (const key of possibleKeys) {
      if (data[key]) {
        return String(data[key]);
      }
    }
  }

  return defaultValue || 'default';
}

/**
 * Param decorator for shard key injection
 */
export const ShardKey = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  const shardKey = request.body?.shardKey || request.query?.shardKey || request.params?.shardKey;

  return shardKey || extractShardKey(request.body || request.params);
});

/**
 * Shard-aware decorator
 */
export function ShardAware(options?: { shardGroup?: string; fallback?: boolean }) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const shardRouter: ShardRouter = this.shardRouter;
      const shardGroup = options?.shardGroup || 'primary';

      // Extract shard key from arguments
      let shardKey = 'default';
      if (args.length > 0) {
        shardKey = extractShardKey(args[0], undefined, 'default');
      }

      try {
        // If method has a shardKey parameter, use it
        const hasShardKey =
          propertyKey.toString().includes('shardKey') ||
          propertyKey.toString().includes('Sharding');

        if (hasShardKey && shardRouter) {
          const targetShard = shardRouter.route(shardKey, shardGroup);
          this.logger?.log?.(`Routing to shard: ${targetShard} for key: ${shardKey}`);
        }
      } catch (error) {
        if (!options?.fallback) {
          throw error;
        }
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
