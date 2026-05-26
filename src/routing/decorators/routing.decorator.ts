import { SetMetadata } from '@nestjs/common';

/**
 * Decorators for routing-related metadata
 */

export const ROUTING_METADATA_KEY = 'routing:metadata';
export const ROUTING_BYPASS_KEY = 'routing:bypass';
export const ROUTING_PRIORITY_KEY = 'routing:priority';

/**
 * Decorator to add routing metadata to controllers/routes
 */
export const RoutingMetadata = (metadata: Record<string, any>) => 
  SetMetadata(ROUTING_METADATA_KEY, metadata);

/**
 * Decorator to bypass routing middleware for specific routes
 */
export const BypassRouting = () => 
  SetMetadata(ROUTING_BYPASS_KEY, true);

/**
 * Decorator to set routing priority for specific routes
 */
export const RoutingPriority = (priority: number) => 
  SetMetadata(ROUTING_PRIORITY_KEY, priority);

/**
 * Decorator for API version routing
 */
export const ApiVersion = (version: string) => 
  RoutingMetadata({ apiVersion: version });

/**
 * Decorator for client type routing
 */
export const ClientType = (type: string) => 
  RoutingMetadata({ clientType: type });

/**
 * Decorator for feature flag routing
 */
export const FeatureFlag = (flag: string) => 
  RoutingMetadata({ featureFlag: flag });

/**
 * Decorator for tenant-specific routing
 */
export const TenantSpecific = (tenantId?: string) => 
  RoutingMetadata({ tenantSpecific: true, tenantId });

/**
 * Decorator for rate limiting configuration
 */
export const RateLimit = (limit: number, window: number) => 
  RoutingMetadata({ rateLimit: { limit, window } });

/**
 * Decorator for caching configuration
 */
export const CacheControl = (maxAge: number, cacheControl?: string) => 
  RoutingMetadata({ cache: { maxAge, cacheControl } });