# Content-Based Routing System

The TeachLink backend implements a comprehensive content-based routing system that allows dynamic routing decisions based on request content, headers, query parameters, and other contextual information.

## Features

### ✅ Pattern-based Routing Rules
- Path pattern matching with regex support
- URL rewriting and forwarding
- Dynamic route configuration
- Priority-based rule evaluation

### ✅ Header-based Routing
- Route based on any HTTP header
- API version routing (`x-api-version`)
- Client type routing (`x-client-type`)
- Custom header conditions

### ✅ Query Parameter Routing
- Route based on query parameters
- Feature flag routing (`?beta=true`)
- A/B testing support
- Parameter transformation

### ✅ Dynamic Routing Configuration
- JSON-based configuration
- Hot-reload capability
- Admin API for rule management
- Rule validation and testing

## Architecture

```
Request → ContentRoutingMiddleware → RoutingEngine → Rule Evaluation → Action Application → Next()
```

### Core Components

1. **RoutingEngine** - Evaluates rules and determines actions
2. **RoutingConfigService** - Manages routing configuration
3. **ContentRoutingMiddleware** - Applies routing logic to requests
4. **RoutingAdminController** - Admin API for rule management

## Configuration

### Routing Rules Structure

```json
{
  "id": "unique-rule-id",
  "name": "Human Readable Name",
  "description": "What this rule does",
  "priority": 100,
  "enabled": true,
  "conditions": [
    {
      "type": "header|query_param|path_pattern|body_content|custom",
      "field": "field-name",
      "operator": "equals|contains|starts_with|regex_match|in|exists",
      "value": "comparison-value",
      "caseSensitive": false
    }
  ],
  "action": {
    "type": "forward|redirect|rewrite|block|rate_limit|cache|transform",
    "target": "target-path-or-identifier",
    "parameters": {},
    "transformations": [
      {
        "type": "header|query|body|path",
        "operation": "add|remove|modify|rename",
        "field": "field-name",
        "value": "new-value"
      }
    ]
  }
}
```

### Example Rules

#### API Version Routing
```json
{
  "id": "api-v2-routing",
  "name": "API Version 2 Routing",
  "priority": 100,
  "enabled": true,
  "conditions": [
    {
      "type": "header",
      "field": "x-api-version",
      "operator": "equals",
      "value": "v2"
    }
  ],
  "action": {
    "type": "rewrite",
    "target": "/api/v2${originalPath}"
  }
}
```

#### Mobile Client Optimization
```json
{
  "id": "mobile-optimization",
  "name": "Mobile Client Routing",
  "priority": 90,
  "enabled": true,
  "conditions": [
    {
      "type": "header",
      "field": "x-client-type",
      "operator": "equals",
      "value": "mobile"
    }
  ],
  "action": {
    "type": "forward",
    "target": "/api/mobile",
    "transformations": [
      {
        "type": "header",
        "operation": "add",
        "field": "x-mobile-optimized",
        "value": "true"
      }
    ]
  }
}
```

#### Admin Access Control
```json
{
  "id": "admin-access",
  "name": "Admin Access Control",
  "priority": 200,
  "enabled": true,
  "conditions": [
    {
      "type": "path_pattern",
      "field": "path",
      "operator": "starts_with",
      "value": "/admin"
    },
    {
      "type": "custom",
      "field": "user.role",
      "operator": "not_equals",
      "value": "ADMIN"
    }
  ],
  "action": {
    "type": "block",
    "target": "unauthorized",
    "parameters": {
      "statusCode": 403,
      "message": "Admin access required"
    }
  }
}
```

## Condition Types

### Header Conditions
```typescript
{
  type: "header",
  field: "x-api-version",
  operator: "equals",
  value: "v2"
}
```

### Query Parameter Conditions
```typescript
{
  type: "query_param",
  field: "beta",
  operator: "equals",
  value: "true"
}
```

### Path Pattern Conditions
```typescript
{
  type: "path_pattern",
  field: "path",
  operator: "regex_match",
  value: "^/api/v[0-9]+/"
}
```

### Body Content Conditions
```typescript
{
  type: "body_content",
  field: "user.type",
  operator: "equals",
  value: "premium"
}
```

### Custom Conditions
```typescript
{
  type: "custom",
  field: "tenant.plan",
  operator: "in",
  value: ["premium", "enterprise"]
}
```

## Operators

- `equals` / `not_equals` - Exact match
- `contains` / `not_contains` - Substring match
- `starts_with` / `ends_with` - Prefix/suffix match
- `regex_match` - Regular expression match
- `in` / `not_in` - Array membership
- `exists` / `not_exists` - Field presence
- `greater_than` / `less_than` - Numeric comparison

## Action Types

### Forward
Continues processing with optional path modification:
```json
{
  "type": "forward",
  "target": "/api/v2"
}
```

### Redirect
Sends HTTP redirect response:
```json
{
  "type": "redirect",
  "target": "/new-path",
  "parameters": {
    "statusCode": 301
  }
}
```

### Rewrite
Internally modifies request URL:
```json
{
  "type": "rewrite",
  "target": "/internal/path"
}
```

### Block
Blocks request with error response:
```json
{
  "type": "block",
  "target": "unauthorized",
  "parameters": {
    "statusCode": 403,
    "message": "Access denied"
  }
}
```

### Rate Limit
Applies additional rate limiting:
```json
{
  "type": "rate_limit",
  "target": "api-calls",
  "parameters": {
    "limit": 100,
    "window": 3600000
  }
}
```

### Cache
Sets cache headers:
```json
{
  "type": "cache",
  "target": "static-assets",
  "parameters": {
    "maxAge": 86400,
    "cacheControl": "public, max-age=86400"
  }
}
```

## Admin API

### Get All Rules
```http
GET /admin/routing/rules
Authorization: Bearer <admin-token>
```

### Create Rule
```http
POST /admin/routing/rules
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "id": "new-rule",
  "name": "New Routing Rule",
  "priority": 50,
  "conditions": [...],
  "action": {...}
}
```

### Update Rule
```http
PUT /admin/routing/rules/{id}
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "enabled": false
}
```

### Test Routing
```http
POST /admin/routing/test
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "method": "GET",
  "path": "/api/users",
  "headers": {
    "x-api-version": "v2"
  },
  "query": {
    "beta": "true"
  }
}
```

### Get Statistics
```http
GET /admin/routing/stats
Authorization: Bearer <admin-token>
```

## Usage Examples

### 1. API Versioning
Route requests to different API versions based on headers:

```typescript
import { RoutingPresets } from '../utils/routing-helpers';

const apiV2Rule = {
  id: 'api-v2',
  name: 'API Version 2',
  priority: 100,
  enabled: true,
  conditions: [RoutingPresets.apiVersion.v2()],
  action: {
    type: 'rewrite',
    target: '/api/v2${originalPath}'
  }
};
```

### 2. Feature Flags
Enable beta features based on query parameters:

```typescript
const betaFeaturesRule = {
  id: 'beta-features',
  name: 'Beta Features',
  priority: 80,
  enabled: true,
  conditions: [RoutingPresets.featureFlags.beta()],
  action: {
    type: 'forward',
    target: '/api/beta',
    transformations: [
      {
        type: 'header',
        operation: 'add',
        field: 'x-beta-enabled',
        value: 'true'
      }
    ]
  }
};
```

### 3. Tenant Routing
Route based on subdomain:

```typescript
const tenantRoutingRule = {
  id: 'tenant-subdomain',
  name: 'Tenant Subdomain Routing',
  priority: 90,
  enabled: true,
  conditions: [RoutingPresets.tenant.subdomainPattern()],
  action: {
    type: 'forward',
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
```

## Performance Considerations

- **Caching**: Rules are cached for 5 minutes by default
- **Priority**: Higher priority rules are evaluated first
- **Short-circuiting**: Evaluation stops at first match
- **Regex**: Use sparingly for performance

## Security

- Admin API requires ADMIN role
- Rule validation prevents malicious configurations
- Blocked requests are logged for monitoring
- Rate limiting can be applied per rule

## Monitoring

- Request routing metrics
- Rule match statistics
- Performance monitoring
- Error tracking and alerting

## Configuration File Location

Default: `./config/routing.json`

Override with environment variable:
```bash
ROUTING_CONFIG_PATH=/path/to/custom/routing.json
```

## Integration

The routing system integrates with:
- Authentication system (user context)
- Multi-tenancy system (tenant context)
- Rate limiting system
- Audit logging system
- Monitoring and metrics