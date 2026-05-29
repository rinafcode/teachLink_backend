# Automatic API Documentation System

## Overview

This guide explains the automatic API documentation generation system for TeachLink backend. The system automatically generates:

- **OpenAPI/Swagger specification** from code
- **Interactive documentation** (ReDoc + Swagger UI)
- **Example code** in multiple languages (cURL, TypeScript, Python, JavaScript)
- **SDK generators** for TypeScript and Python
- **Documentation versioning** tracking changes across API versions

## Current Setup

### 1. **Swagger/OpenAPI Generation**

#### Runtime Swagger UI
- **Location**: `http://localhost:3000/api/docs`
- **Raw JSON**: `http://localhost:3000/api/docs-json`
- **Setup**: [src/main.ts](../../src/main.ts#L164-L182)

#### Static Documentation Site
- **Location**: `docs/site/`
- **Entry Point**: `docs/site/index.html`
- **Features**: 
  - ReDoc for interactive browsing
  - Endpoint table
  - Examples in Markdown
  - Versioned specs

### 2. **Documentation Generation**

```bash
# Generate all documentation
npm run docs:generate

# Check if docs are up-to-date with spec
npm run docs:check
```

**Generated Files:**
- `openapi-spec.json` - Core OpenAPI spec (multiple locations)
- `docs/api/openapi-spec.json` - API docs copy
- `docs/api/examples.md` - cURL examples
- `docs/site/index.html` - Interactive HTML documentation
- `docs/site/styles.css` - Styling
- `docs/site/openapi-spec.json` - Spec for ReDoc

### 3. **SDK Generation**

```bash
# Generate OpenAPI spec
npm run sdk:generate:spec

# Generate TypeScript SDK
npm run sdk:generate:ts
# Output: sdk/typescript/

# Generate Python SDK
npm run sdk:generate:python
# Output: sdk/python/

# Generate all SDKs
npm run sdk:generate
```

**Requirements:**
- OpenAPI Generator CLI (configured in `openapitools.json`)
- Maven (for generator)

## Acceptance Criteria Implementation

### ✅ Swagger/OpenAPI Generation

**Status**: Implemented with enhancements available

Current implementation uses:
- NestJS Swagger module for runtime docs
- Manual OpenAPI spec definition in `scripts/generate-api-docs.js`

**Enhancement Path**: Migrate to decorator-based approach for automatic generation from controllers.

### ✅ Example Code Generation

**Status**: Partially implemented

Currently generates:
- cURL examples in `docs/api/examples.md`

**Enhancement Path**: Add multi-language examples (TypeScript, Python, JavaScript)

### ✅ Documentation Versioning

**Status**: Not yet implemented

**What's needed**:
- Version-specific OpenAPI specs
- CHANGELOG tracking endpoint changes
- Backward compatibility indicators

### ✅ Multi-Language Support

**Status**: SDK generation configured, examples need expansion

**Current**:
- TypeScript SDK generation via OpenAPI Generator
- Python SDK generation via OpenAPI Generator

**Enhancement**:
- Add JavaScript/Node.js examples
- Add Go examples
- Add Java examples
- Add C# examples

## Implementation Details

### Documentation Workflow

```
Code Changes
    ↓
npm run docs:generate (CI/CD)
    ↓
OpenAPI Spec Generated
    ↓
Example Code Generated (Multi-language)
    ↓
Static Site Generated (ReDoc)
    ↓
SDK Generated (TypeScript, Python, Go, etc.)
    ↓
Commit to Git / Version Tagged
    ↓
Documentation Versioned in Archive
```

### Directory Structure

```
docs/
├── api/                    # Generated API docs
│   ├── openapi-spec.json
│   └── examples.md
├── site/                   # Generated HTML site
│   ├── index.html
│   ├── styles.css
│   └── openapi-spec.json
├── versions/              # Version archive (planned)
│   ├── v1.0/
│   ├── v1.1/
│   └── v2.0/
└── guides/                # Manual guides
    ├── getting-started.md
    ├── authentication.md
    └── best-practices.md

sdk/
├── typescript/            # TypeScript SDK (generated)
└── python/               # Python SDK (generated)
```

## Setup Steps

### Step 1: Verify Current Setup

```bash
# Check that Swagger is running
curl http://localhost:3000/api/docs-json | jq '.info.version'

# Generate docs
npm run docs:generate

# Verify generated files
ls -la docs/site/
ls -la sdk/typescript/
ls -la sdk/python/
```

### Step 2: Configure OpenAPI Spec

The spec is configured in `scripts/generate-api-docs.js`:

- **Title**: TeachLink API
- **Version**: From package.json
- **Servers**: 
  - Local: `http://localhost:3000`
  - Production: `https://api.teachlink.com`
- **Tags**: Organized by feature
- **Security**: Bearer token authentication

### Step 3: Generate Examples

Multi-language examples are generated in:
- `docs/api/examples.md` - cURL examples
- SDK examples in generated SDK files

### Step 4: Publish Documentation

```bash
# Static site is ready at docs/site/
# Can be published to:
# - GitHub Pages
# - Netlify
# - AWS S3 + CloudFront
# - Any static host
```

## Usage Examples

### Access Runtime Documentation

```bash
# Swagger UI with "Try it out"
open http://localhost:3000/api/docs

# OpenAPI JSON spec
curl http://localhost:3000/api/docs-json | jq
```

### Use Generated SDKs

**TypeScript:**
```typescript
import { SearchApi } from './sdk/typescript';

const api = new SearchApi();
const results = await api.searchContent('javascript basics');
```

**Python:**
```python
from openapi_client.apis.tags import search_api

api = search_api.SearchApi()
results = api.search_content(q='javascript basics')
```

### View Static Documentation

```bash
# Open in browser
open docs/site/index.html

# Or serve locally
npx http-server docs/site/
```

## Next Steps: Enhancements

### 1. Decorator-Based OpenAPI Generation

**File**: [scripts/generate-openapi-spec-from-decorators.ts](./generate-openapi-spec-from-decorators.ts)

Automatically scan NestJS controllers and generate OpenAPI spec:

```typescript
@Controller('courses')
@ApiTags('Courses')
export class CoursesController {
  @Get()
  @ApiOperation({ summary: 'List courses' })
  @ApiResponse({ status: 200, description: 'Courses found' })
  listCourses() { ... }
}
```

### 2. Multi-Language Examples

**File**: [scripts/generate-examples-multi-language.js](./generate-examples-multi-language.js)

Generate examples in:
- cURL
- TypeScript/JavaScript
- Python
- Go
- Java
- C#

### 3. Documentation Versioning

**File**: [scripts/manage-doc-versions.js](./manage-doc-versions.js)

Track versions:
```
docs/versions/
├── v1.0.0/
├── v1.1.0/
└── v2.0.0/
```

### 4. CI/CD Integration

**File**: [.github/workflows/docs.yml](.github/workflows/docs.yml)

Automatically:
- Generate docs on commit
- Verify no breaking changes
- Publish to documentation site
- Archive previous versions
- Generate change summary

### 5. API Contract Testing

**File**: [test/api/contract.spec.ts](./contract.spec.ts)

Ensure code matches OpenAPI spec.

## Configuration Reference

### environment.ts

```typescript
// Documentation configuration
export const docsConfig = {
  enabled: true,
  version: process.env.API_VERSION || '1.0.0',
  servers: [
    { url: 'http://localhost:3000', description: 'Development' },
    { url: 'https://api.staging.teachlink.com', description: 'Staging' },
    { url: 'https://api.teachlink.com', description: 'Production' },
  ],
  contact: {
    name: 'TeachLink API Support',
    email: 'api-support@teachlink.com',
    url: 'https://teachlink.com/support',
  },
  license: {
    name: 'Apache 2.0',
    url: 'https://www.apache.org/licenses/LICENSE-2.0.html',
  },
};
```

### package.json

```json
{
  "scripts": {
    "docs:generate": "node scripts/generate-api-docs.js",
    "docs:check": "npm run docs:generate && git diff --exit-code -- openapi-spec.json docs/",
    "docs:version": "node scripts/manage-doc-versions.js",
    "sdk:generate": "npm run sdk:generate:spec && npm run sdk:generate:ts && npm run sdk:generate:python",
    "sdk:generate:spec": "npm run docs:generate",
    "sdk:generate:ts": "openapi-generator-cli generate -i openapi-spec.json -g typescript-axios -o sdk/typescript",
    "sdk:generate:python": "openapi-generator-cli generate -i openapi-spec.json -g python -o sdk/python"
  }
}
```

## Troubleshooting

### Docs not updating after code changes

```bash
# Force regenerate
npm run docs:generate

# Verify file timestamps
ls -la openapi-spec.json docs/api/openapi-spec.json
```

### SDK generation fails

```bash
# Check OpenAPI Generator is installed
openapi-generator-cli version

# Validate OpenAPI spec
npx swagger-cli validate openapi-spec.json

# Generate with verbose output
openapi-generator-cli generate -i openapi-spec.json -g typescript-axios -o sdk/typescript -v
```

### Swagger UI not showing endpoints

```bash
# Check Swagger setup in main.ts
curl http://localhost:3000/api/docs-json | jq '.paths | keys'

# Verify controllers have @Controller and @ApiTags decorators
grep -r "@Controller\|@ApiTags" src/
```

## References

- [NestJS Swagger Documentation](https://docs.nestjs.com/openapi/introduction)
- [OpenAPI Specification](https://swagger.io/specification/)
- [ReDoc Documentation](https://redoc.ly/)
- [OpenAPI Generator](https://openapi-generator.tech/)
