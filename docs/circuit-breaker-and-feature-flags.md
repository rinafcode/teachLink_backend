# Circuit Breaker & Feature Toggle System Implementation

## Overview

This document describes the implementation of two critical reliability and flexibility features:
1. **Circuit Breaker Pattern** (Issue #390)
2. **Feature Toggle System** (Issue #391)

---

## 1. Circuit Breaker Pattern (Issue #390)

### Features Implemented

✅ **Enhanced Circuit Breaker with Opossum**
- Production-ready circuit breaker using the opossum library
- Three states: CLOSED (normal), OPEN (failing), HALF_OPEN (testing recovery)
- Configurable thresholds and timeouts
- Automatic fallback handling

✅ **Circuit Breaker Decorator & Interceptor**
- Easy-to-use `@UseCircuitBreaker()` decorator
- Per-endpoint configuration
- Automatic fallback function support

✅ **Health Monitoring & Metrics**
- Real-time circuit breaker statistics
- Health status endpoint
- Admin API for manual control (reset, enable, disable)
- Error rate tracking

✅ **Fallback Handlers**
- Graceful degradation when services fail
- Custom fallback functions per endpoint
- Default fallback responses

### Architecture

```
src/common/
├── services/
│   └── circuit-breaker.service.ts      # Enhanced circuit breaker with opossum
├── decorators/
│   └── circuit-breaker.decorator.ts    # @UseCircuitBreaker() decorator
├── interceptors/
│   └── circuit-breaker.interceptor.ts  # Request interception
└── controllers/
    └── circuit-breaker.controller.ts   # Admin API for monitoring
```

### Configuration

Add to `.env`:

```env
# Circuit Breaker Configuration
CIRCUIT_BREAKER_TIMEOUT_MS=3000              # Timeout before considering call failed
CIRCUIT_BREAKER_ERROR_THRESHOLD=50           # Error % to open circuit (1-100)
CIRCUIT_BREAKER_RESET_TIMEOUT_MS=30000       # Time to wait before testing recovery
CIRCUIT_BREAKER_ROLLING_COUNT_TIMEOUT=60000  # Stats tracking window
CIRCUIT_BREAKER_ROLLING_COUNT_BUCKETS=10     # Number of stat buckets
```

### Usage Example

#### Basic Usage

```typescript
import { UseCircuitBreaker } from '../common/decorators/circuit-breaker.decorator';
import { CircuitBreakerInterceptor } from '../common/interceptors/circuit-breaker.interceptor';

@Get('external-data')
@UseCircuitBreaker({
  key: 'external-api',
  timeout: 5000,
  errorThresholdPercentage: 50,
  fallback: (error) => ({ data: [], cached: true })
})
@UseInterceptors(CircuitBreakerInterceptor)
async getExternalData() {
  return this.externalService.fetchData();
}
```

#### Advanced Usage with Custom Fallback

```typescript
@Post('process-payment')
@UseCircuitBreaker({
  key: 'payment-gateway',
  timeout: 10000,
  errorThresholdPercentage: 30,
  resetTimeout: 60000,
  fallback: async (error) => {
    // Queue payment for later processing
    await this.queueService.add('retry-payment', paymentData);
    return { status: 'queued', message: 'Payment queued for processing' };
  }
})
@UseInterceptors(CircuitBreakerInterceptor)
async processPayment(@Body() paymentDto: PaymentDto) {
  return this.paymentGateway.charge(paymentDto);
}
```

### API Endpoints

All endpoints require **ADMIN** role and JWT authentication.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/circuit-breakers` | Get all circuit breaker statistics |
| GET | `/circuit-breakers/health` | Get overall health status |
| GET | `/circuit-breakers/:key` | Get specific circuit breaker stats |
| POST | `/circuit-breakers/:key/reset` | Reset a circuit breaker |
| POST | `/circuit-breakers/:key/disable` | Disable a circuit breaker |
| POST | `/circuit-breakers/:key/enable` | Enable a circuit breaker |

### Circuit Breaker States

1. **CLOSED** (Normal Operation)
   - Requests flow through normally
   - Errors are tracked
   - When error threshold is reached, moves to OPEN

2. **OPEN** (Failing)
   - All requests fail immediately
   - Prevents cascading failures
   - After reset timeout, moves to HALF_OPEN

3. **HALF_OPEN** (Testing Recovery)
   - Limited test requests allowed
   - If successful, moves to CLOSED
   - If fails, moves back to OPEN

### Metrics Tracked

- Successes: Number of successful calls
- Failures: Number of failed calls
- Rejects: Number of rejected calls (circuit open)
- Timeouts: Number of timed-out calls
- Fallbacks: Number of fallback executions
- Error rate: Percentage of failed calls

---

## 2. Feature Toggle System (Issue #391)

### Features Implemented

✅ **Dynamic Feature Flag Configuration**
- Runtime feature evaluation
- Boolean, string, number, and JSON flag types
- Per-flag configuration and metadata

✅ **Advanced Targeting & Rollout**
- User-specific targeting rules
- Gradual rollout percentages
- A/B testing integration
- Prerequisite flag support

✅ **Admin API**
- CRUD operations for feature flags
- Enable/disable flags instantly
- Evaluate flags for specific users
- Bulk evaluation for all flags

✅ **Analytics & Tracking**
- Flag evaluation tracking
- Impression tracking for experiments
- Performance metrics

### Architecture

```
src/feature-flags/
├── feature-flags.controller.ts         # Admin REST API
├── feature-flags.module.ts             # Module definition
├── evaluation/
│   └── flag-evaluation.service.ts      # Core evaluation logic
├── targeting/
│   └── targeting.service.ts            # User targeting rules
├── rollout/
│   └── rollout.service.ts              # Gradual rollout logic
├── experimentation/
│   └── experimentation.service.ts      # A/B testing
├── analytics/
│   └── flag-analytics.service.ts       # Usage tracking
└── interfaces/
    └── index.ts                        # Type definitions
```

### Usage Example

#### Creating a Feature Flag

```bash
curl -X POST http://localhost:3000/feature-flags \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "new-checkout-flow",
    "description": "Enable new checkout experience",
    "enabled": true,
    "valueType": "boolean",
    "defaultValue": false
  }'
```

#### Evaluating a Flag in Code

```typescript
import { FlagEvaluationService } from './feature-flags/evaluation/flag-evaluation.service';

@Injectable()
export class CheckoutService {
  constructor(
    private readonly flagService: FlagEvaluationService,
  ) {}

  async getCheckoutFlow(userId: string) {
    const userContext = {
      userId,
      email: 'user@example.com',
      attributes: { plan: 'premium' }
    };

    const result = this.flagService.evaluate('new-checkout-flow', userContext);
    
    if (result.value === true) {
      return this.newCheckoutFlow();
    }
    return this.legacyCheckoutFlow();
  }
}
```

#### Using Convenience Methods

```typescript
// Boolean evaluation
const isEnabled = this.flagService.evaluateBoolean('new-feature', userContext);

// String evaluation
const theme = this.flagService.evaluateString('ui-theme', userContext, 'light');

// Number evaluation  
const maxItems = this.flagService.evaluateNumber('page-size', userContext, 10);
```

### API Endpoints

#### Admin Endpoints (Require ADMIN role)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/feature-flags` | Get all feature flags |
| GET | `/feature-flags/:key` | Get specific flag |
| POST | `/feature-flags` | Create new flag |
| PUT | `/feature-flags/:key` | Update flag |
| DELETE | `/feature-flags/:key` | Delete flag |
| POST | `/feature-flags/:key/enable` | Enable flag |
| POST | `/feature-flags/:key/disable` | Disable flag |

#### Public Endpoints (Authenticated users)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/feature-flags/evaluate?key=xxx` | Evaluate single flag |
| POST | `/feature-flags/evaluate-all` | Evaluate all flags |

### Flag Configuration Structure

```typescript
{
  id: "flag_1234567890",
  key: "new-checkout-flow",
  description: "Enable new checkout experience",
  enabled: true,
  archived: false,
  valueType: "boolean",
  variations: [
    { key: "on", value: true },
    { key: "off", value: false }
  ],
  defaultValue: false,
  defaultVariationKey: "on",
  offVariationKey: "off",
  
  // Optional: Targeting rules
  targeting: {
    rules: [
      {
        conditions: [
          { attribute: "plan", operator: "equals", value: "premium" }
        ],
        variationKey: "on"
      }
    ]
  },
  
  // Optional: Gradual rollout
  rollout: {
    percentage: 50,  // 50% of users
    variationKey: "on"
  },
  
  // Optional: A/B test
  experiment: {
    id: "exp_123",
    variations: [
      { key: "control", weight: 50 },
      { key: "treatment", weight: 50 }
    ]
  }
}
```

### Evaluation Order

1. **Flag disabled/archived** → Returns off variation
2. **Prerequisites** → Checks dependent flags
3. **Targeting rules** → User attribute matching
4. **A/B experiment** → Variant assignment
5. **Gradual rollout** → Percentage-based rollout
6. **Default** → Returns default variation

---

## Applying Circuit Breakers to External Services

### Recommended Services to Protect

1. **Payment Gateway** (Stripe)
```typescript
@Post('charge')
@UseCircuitBreaker({
  key: 'stripe-payments',
  timeout: 10000,
  errorThresholdPercentage: 30,
  fallback: () => ({ status: 'retry_later' })
})
@UseInterceptors(CircuitBreakerInterceptor)
async chargeCard() { ... }
```

2. **Email Service** (SendGrid/SMTP)
```typescript
@Post('send-email')
@UseCircuitBreaker({
  key: 'email-service',
  timeout: 5000,
  errorThresholdPercentage: 50,
  fallback: () => ({ queued: true })
})
@UseInterceptors(CircuitBreakerInterceptor)
async sendEmail() { ... }
```

3. **AWS S3**
```typescript
@Post('upload')
@UseCircuitBreaker({
  key: 'aws-s3',
  timeout: 15000,
  errorThresholdPercentage: 40
})
@UseInterceptors(CircuitBreakerInterceptor)
async uploadFile() { ... }
```

4. **Elasticsearch**
```typescript
@Get('search')
@UseCircuitBreaker({
  key: 'elasticsearch',
  timeout: 3000,
  errorThresholdPercentage: 50,
  fallback: () => ({ results: [], fromCache: true })
})
@UseInterceptors(CircuitBreakerInterceptor)
async search() { ... }
```

---

## Testing

### Run Tests

```bash
# Circuit breaker tests
npm test -- circuit-breaker.service.spec.ts

# Feature flags tests
npm test -- flag-evaluation.service.spec.ts

# All tests
npm test
```

---

## Monitoring & Alerting

### Circuit Breaker Alerts

Monitor these metrics and set alerts:

- **Circuit Open Events**: Immediate alert when circuit opens
- **High Error Rate**: Alert when error rate > 30%
- **Frequent Fallbacks**: Alert when fallback usage spikes
- **Recovery Time**: Track time from OPEN to CLOSED

### Feature Flag Alerts

- **Flag Evaluation Errors**: Track evaluation failures
- **Disabled Flags**: Alert on critical disabled flags
- **Rollout Progress**: Monitor gradual rollout percentages
- **Experiment Performance**: Track A/B test metrics

---

## Best Practices

### Circuit Breaker

- ✅ Set appropriate timeout values per service
- ✅ Always provide fallback handlers for critical paths
- ✅ Monitor circuit breaker metrics continuously
- ✅ Test fallback paths regularly
- ✅ Use different keys for different external services
- ✅ Start with conservative thresholds and adjust

### Feature Flags

- ✅ Use descriptive flag keys (e.g., `new-checkout-flow-v2`)
- ✅ Add clear descriptions for each flag
- ✅ Remove flags after feature stabilization
- ✅ Use targeting for gradual rollouts
- ✅ Track flag evaluation performance
- ✅ Document flag ownership and purpose
- ✅ Use prerequisites for dependent features

---

## Troubleshooting

### Circuit Breaker Issues

**Circuit opens too frequently:**
- Increase error threshold percentage
- Check external service health
- Review timeout settings
- Implement better error handling

**Circuit never closes:**
- Check if fallback is masking real issues
- Verify reset timeout is appropriate
- Review external service recovery

**Performance degradation:**
- Reduce rolling count timeout
- Monitor circuit breaker overhead
- Check for too many circuit breakers

### Feature Flag Issues

**Flag not evaluating correctly:**
- Verify flag is enabled
- Check targeting rules
- Review user context attributes
- Check prerequisite flags

**Slow evaluation:**
- Reduce number of targeting rules
- Cache evaluation results
- Monitor analytics service performance

---

## Future Enhancements

- [ ] Database persistence for feature flags
- [ ] Redis caching for flag evaluations
- [ ] Circuit breaker dashboard UI
- [ ] Feature flag UI for non-technical users
- [ ] Scheduled flag enable/disable
- [ ] Circuit breaker event streaming
- [ ] Integration with monitoring tools (Datadog, New Relic)
- [ ] Flag import/export functionality

---

## References

- Issue #390: https://github.com/rinafcode/teachLink_backend/issues/390
- Issue #391: https://github.com/rinafcode/teachLink_backend/issues/391
- Opossum Docs: https://nodeshift.github.io/opossum/
- Martin Fowler - Circuit Breaker: https://martinfowler.com/bliki/CircuitBreaker.html
- Feature Flags Best Practices: https://launchdarkly.com/blog/feature-flag-best-practices/
