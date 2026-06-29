# Cache TTL Optimization System

This module provides comprehensive cache optimization with TTL analytics, hit rate optimization, adaptive TTL adjustment, and configuration recommendations.

## Features

### 1. TTL Analytics
- Real-time tracking of cache hit rates, access frequency, and data sizes
- Performance metrics collection and analysis
- Automated cleanup of old metrics data

### 2. Hit Rate Optimization
- Identifies underperforming cache keys
- Automatically adjusts TTL values based on performance
- Removes low-performing keys to free memory

### 3. Adaptive TTL Adjustment
- Dynamic TTL adjustment based on usage patterns
- Rule-based configuration for different key patterns
- Automatic optimization runs via cron jobs

### 4. Configuration Recommendations
- Generates TTL recommendations based on analytics
- Provides confidence scores and potential savings estimates
- Admin interface for cache management

## Usage

### Basic Cache Operations with Analytics

```typescript
import { CacheOptimizationService } from './cache-optimization.service';

@Injectable()
export class MyService {
  constructor(private cacheService: CacheOptimizationService) {}

  async getData(key: string) {
    // Enhanced get with analytics tracking
    let data = await this.cacheService.get<MyData>(key);
    
    if (!data) {
      data = await this.fetchFromDatabase(key);
      // Enhanced set with adaptive TTL
      await this.cacheService.set(key, data, 300); // 5 minutes default
    }
    
    return data;
  }
}
```

### Manual Cache Optimization

```typescript
import { CacheOptimizationService } from './cache-optimization.service';

@Injectable()
export class CacheMaintenanceService {
  constructor(private optimizationService: CacheOptimizationService) {}

  async runOptimization() {
    const result = await this.optimizationService.optimizeCache();
    console.log(`Applied ${result.optimizationsApplied} optimizations`);
    console.log(`Freed ${result.memoryFreed} bytes of memory`);
    console.log(`Hit rate improvement: ${result.hitRateImprovement}`);
  }
}
```

### Analytics Reports

```typescript
import { CacheAnalyticsService } from './cache-analytics.service';

@Injectable()
export class CacheReportingService {
  constructor(private analyticsService: CacheAnalyticsService) {}

  async generateReport() {
    const report = await this.analyticsService.generateAnalyticsReport();
    
    console.log(`Total cache keys: ${report.totalKeys}`);
    console.log(`Overall hit rate: ${report.overallHitRate}`);
    console.log(`Memory usage: ${report.memoryUsage} bytes`);
    console.log(`TTL recommendations: ${report.ttlRecommendations.length}`);
  }
}
```

## API Endpoints

The cache management controller provides the following endpoints:

- `GET /cache/analytics/report` - Get comprehensive analytics report
- `GET /cache/ttl/recommendations` - Get TTL optimization recommendations
- `POST /cache/optimize` - Run comprehensive cache optimization
- `GET /cache/config` - Get optimization configuration
- `PUT /cache/config` - Update optimization configuration
- `GET /cache/stats` - Get real-time cache statistics
- `GET /cache/health` - Check cache system health

## Configuration

Environment variables for cache optimization:

```env
# Adaptive TTL Configuration
CACHE_ADAPTIVE_TTL_ENABLED=true
CACHE_MIN_SAMPLE_SIZE=100

# Optimization Thresholds
CACHE_HIT_RATE_OPTIMIZATION_ENABLED=true
CACHE_MEMORY_OPTIMIZATION_ENABLED=true
CACHE_MIN_HIT_RATE_THRESHOLD=0.6
CACHE_MAX_MEMORY_THRESHOLD=0.8
CACHE_OPTIMIZATION_INTERVAL_MINUTES=60

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Adaptive TTL Rules

The system includes default rules for different cache key patterns:

- User profiles: 5 minutes - 1 hour TTL
- Course data: 3 minutes - 30 minutes TTL  
- Search results: 1 minute - 10 minutes TTL
- Popular content: 10 minutes - 2 hours TTL
- Enrollment data: 2 minutes - 15 minutes TTL

Rules automatically adjust TTL based on:
- Hit rate thresholds
- Access frequency patterns
- Performance metrics

## Monitoring

The system provides comprehensive monitoring through:

- Real-time analytics collection
- Performance event emission
- Automated optimization reports
- Health status checks
- TTL adjustment tracking

## Automatic Optimization

The system runs automatic optimizations:

- **Hourly**: Adaptive TTL adjustments based on performance
- **Daily**: Cleanup of old metrics and adjustment records
- **On-demand**: Manual optimization via API endpoints

This ensures optimal cache performance with minimal manual intervention.