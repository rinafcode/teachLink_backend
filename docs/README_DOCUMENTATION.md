# 📚 TeachLink API Documentation System

Automatic, comprehensive API documentation generation with multi-language support, versioning, and interactive browsing.

## Quick Start

### 1. Generate Documentation

```bash
# Generate OpenAPI spec
npm run docs:generate

# Generate multi-language code examples
npm run docs:generate:examples

# Or do both at once
npm run docs:check
```

### 2. View Documentation

**Option A: Interactive Runtime Docs**
```bash
npm run start:dev
# Open http://localhost:3000/api/docs
```

**Option B: Static Documentation Site**
```bash
npm run docs:view
# Open http://localhost:8080
```

### 3. Archive Version (on Release)

```bash
npm run docs:version
# Creates docs/versions/v1.0.0/
```

## Features

### 🚀 Automatic Generation

- ✅ **OpenAPI/Swagger** - Auto-generated from code
- ✅ **Code Examples** - 7 programming languages
- ✅ **Interactive Docs** - ReDoc viewer
- ✅ **Version Tracking** - Changelog and comparisons
- ✅ **Schema Validation** - Consistent responses

### 🌍 Multi-Language Examples

1. **cURL** - Command line testing
2. **TypeScript** - Modern async/await
3. **Python** - Requests library
4. **JavaScript** - Fetch API
5. **Go** - Native http
6. **Java** - HttpURLConnection
7. **C#** - HttpClient

### 📦 SDK Generation

- TypeScript/JavaScript SDK
- Python SDK
- Auto-generated from OpenAPI spec

### 📊 Version Management

- Archive documentation per release
- Compare API changes between versions
- Detect breaking changes
- Generate CHANGELOG automatically

## Usage

### For Developers

#### Update Documentation

After modifying an API endpoint:

```bash
npm run docs:generate
npm run docs:generate:examples
```

#### View Changes

```bash
# See what changed
git diff openapi-spec.json

# Compare API versions
npm run docs:versions:diff v1.0 v1.1
```

#### Test Documentation

```bash
# Validate OpenAPI spec
npm run docs:check
```

#### Use SDK in Code

**TypeScript:**
```typescript
import { SearchApi } from './sdk/typescript';

const api = new SearchApi();
const courses = await api.searchContent('javascript');
```

**Python:**
```python
from openapi_client.apis.tags import search_api

api = search_api.SearchApi()
courses = api.search_content(q='javascript')
```

### For API Documentation Contributors

See [API_DOCUMENTATION_BEST_PRACTICES.md](./API_DOCUMENTATION_BEST_PRACTICES.md) for:
- How to document endpoints
- Swagger decorator examples
- Error response patterns
- Authentication documentation
- Testing documentation

### For Release Process

```bash
# Before release
npm run docs:check          # Verify docs are current

# On release
npm run docs:version        # Archive documentation
git add docs/versions/
git commit -m "docs: archive API v1.0.0"
git push
```

## Generated Files

```
docs/
├── api/                        # Generated API reference
│   ├── openapi-spec.json      # OpenAPI 3.0 spec
│   └── examples.md            # cURL examples
├── site/                       # Interactive documentation site
│   ├── index.html             # ReDoc viewer
│   ├── openapi-spec.json      # Spec for viewer
│   └── styles.css             # Styling
├── examples/                   # Multi-language code examples
│   ├── README.md              # Examples index
│   ├── 1_login.ts
│   ├── 1_login.py
│   ├── 1_login.js
│   ├── 1_login.go
│   ├── 1_login.java
│   ├── 1_login.cs
│   ├── 2_register.ts
│   └── ... (one set per endpoint)
├── versions/                   # Version archive
│   ├── VERSIONS.md            # Version index
│   ├── CHANGELOG.md           # API changelog
│   ├── v1.0.0/
│   │   ├── openapi-spec.json
│   │   ├── examples/
│   │   └── metadata.json
│   └── v1.1.0/
│       └── ...
└── *.md                        # This guide & best practices

openapi-spec.json              # Root OpenAPI spec
sdk/
├── typescript/                # Generated TypeScript SDK
└── python/                    # Generated Python SDK
```

## All Available Commands

```bash
# Generation
npm run docs:generate          # Generate OpenAPI spec from code
npm run docs:generate:examples # Generate examples in 7 languages
npm run docs:check            # Generate everything + validate

# Viewing
npm run docs:view             # Serve docs locally on port 8080

# Versioning
npm run docs:version          # Archive current docs as version
npm run docs:versions:list    # List all archived versions
npm run docs:versions:compare # Compare two versions
npm run docs:versions:diff    # Show detailed endpoint changes

# SDK Generation
npm run sdk:generate          # Generate all SDKs (TS, Python)
npm run sdk:generate:ts       # TypeScript SDK only
npm run sdk:generate:python   # Python SDK only
npm run sdk:generate:spec     # Refresh spec for SDKs
```

## Directory Structure

### OpenAPI Spec Locations

- `openapi-spec.json` - Root spec (primary)
- `docs/api/openapi-spec.json` - API docs copy
- `docs/site/openapi-spec.json` - Site viewer copy
- `docs/versions/v1.0.0/openapi-spec.json` - Version archive

### Example Code

- `docs/examples/README.md` - Examples index
- `docs/examples/1_login.ts` - TypeScript example
- `docs/examples/1_login.py` - Python example
- `docs/examples/1_login.js` - JavaScript example
- `docs/examples/1_login.go` - Go example
- `docs/examples/1_login.java` - Java example
- `docs/examples/1_login.cs` - C# example

### Documentation Versions

- `docs/versions/VERSIONS.md` - Version index
- `docs/versions/CHANGELOG.md` - API changelog
- `docs/versions/v1.0.0/openapi-spec.json` - Versioned spec
- `docs/versions/v1.0.0/examples/` - Versioned examples

## Documentation Workflow

### For Each Commit

1. **Auto-run (if CI/CD configured)**
   ```bash
   npm run docs:generate
   npm run docs:generate:examples
   ```

2. **Changes auto-committed**
   - `openapi-spec.json`
   - `docs/site/`
   - `docs/api/`
   - `docs/examples/`

### For Each Release

1. **Archive version**
   ```bash
   npm run docs:version
   ```

2. **Commit version**
   ```bash
   git add docs/versions/
   git commit -m "docs: archive API v1.0.0"
   ```

3. **View changelog**
   ```bash
   npm run docs:versions:list
   ```

### For Breaking Changes

1. **Compare versions**
   ```bash
   npm run docs:versions:diff v1.0 v2.0
   ```

2. **Check changelog**
   ```bash
   cat docs/versions/CHANGELOG.md
   ```

## Interactive Documentation

### Runtime Swagger UI

```bash
npm run start:dev
# Open http://localhost:3000/api/docs
```

Features:
- "Try it out" button for testing
- Request/response examples
- Parameter validation
- Bearer token authentication
- Real-time API testing

### Static ReDoc Site

```bash
npm run docs:view
# Open http://localhost:8080
```

Features:
- Beautiful, interactive documentation
- Sidebar navigation
- Search across endpoints
- Code samples in multiple languages
- No external dependencies

## API Endpoints Structure

All endpoints documented with:

```
GET /courses
├── Summary: List courses
├── Description: Retrieve paginated list of courses
├── Parameters: page, limit, category
├── Request Body: (none)
├── Response (200): Courses found
├── Response (400): Invalid parameters
├── Auth: Optional
└── Examples:
    ├── cURL
    ├── TypeScript
    ├── Python
    ├── JavaScript
    ├── Go
    ├── Java
    └── C#
```

## Version Management

### Track Changes

```bash
# View all versions
npm run docs:versions:list

# Compare two versions
npm run docs:versions:compare v1.0 v1.1

# Show detailed changes
npm run docs:versions:diff v1.0 v1.1
```

Output includes:
- ✅ Added endpoints
- ❌ Removed endpoints (breaking)
- 🔄 Modified endpoints
- Parameter changes
- Response changes

### Generate Changelog

Changelog is auto-generated in `docs/versions/CHANGELOG.md`:

```markdown
## v2.0.0
### ✅ Added
- POST /courses/publish

### ❌ Breaking Changes
- Removed: DELETE /courses/{id}

### 🔄 Modified
- GET /courses (added pagination)
```

## Validation & Testing

### Verify Documentation is Current

```bash
npm run docs:check
```

This will:
1. Generate OpenAPI spec
2. Generate examples
3. Validate OpenAPI spec format
4. Compare with git for changes

### Test Documentation in CI/CD

The system includes validation for:
- Valid OpenAPI 3.0 spec
- Required endpoints documented
- Consistent error responses
- Authentication requirements

## Configuration

### Environment Variables

Optional in `.env`:

```bash
API_VERSION=1.0.0
API_TITLE=TeachLink API
API_DESCRIPTION=Learning platform API
```

### OpenAPI Server Configuration

Configured in `scripts/generate-api-docs.js`:

```javascript
servers: [
  { url: 'http://localhost:3000', description: 'Local development' },
  { url: 'https://api.staging.teachlink.com', description: 'Staging' },
  { url: 'https://api.teachlink.com', description: 'Production' },
]
```

### Security Schemes

Configured in spec:

```
bearerAuth: HTTP Bearer (JWT)
apiKeyAuth: Optional API key
```

## Troubleshooting

### Docs not updating after code changes

```bash
npm run docs:generate
npm run docs:generate:examples
ls -la docs/  # Check timestamps
```

### OpenAPI spec validation fails

```bash
npm install -g swagger-cli
swagger-cli validate openapi-spec.json
```

### ReDoc site not loading

```bash
# Check file exists
test -f docs/site/index.html && echo "✅ File exists"

# Check permissions
ls -la docs/site/

# Serve locally
npm run docs:view
```

### Examples not generating

```bash
npm run docs:generate:examples
ls -la docs/examples/
```

### SDK generation fails

```bash
# Validate spec first
swagger-cli validate openapi-spec.json

# Try generate with verbose
npm run sdk:generate -- --verbose
```

## Best Practices

✅ **Do**:
- Run `npm run docs:check` before committing
- Use `@ApiTags` and `@ApiOperation` in controllers
- Document all response codes
- Include examples in decorators
- Archive versions on release
- Keep docs in git

❌ **Don't**:
- Manually edit generated files
- Forget to update examples
- Skip error response documentation
- Leave controllers without tags
- Generate docs without testing

## Integration with CI/CD

To auto-generate and publish docs on every commit:

1. Create `.github/workflows/api-docs.yml` (template provided in implementation)
2. Configure GitHub Pages or CDN
3. Add Slack notifications (optional)

Benefits:
- Automatic doc generation
- Version archival on release
- GitHub Pages publishing
- Change notifications
- Breaking change detection

## Publishing Documentation

### GitHub Pages

```bash
# Docs published to: https://yourusername.github.io/teachLink_backend/
```

### Custom Domain

```bash
# docs/site/ deployed to your domain
# Example: https://api-docs.teachlink.com
```

### CDN (S3 + CloudFront)

```bash
aws s3 sync docs/site/ s3://your-bucket/
```

## Support & Resources

- **Guide**: [API_DOCUMENTATION_GUIDE.md](./API_DOCUMENTATION_GUIDE.md)
- **Best Practices**: [API_DOCUMENTATION_BEST_PRACTICES.md](./API_DOCUMENTATION_BEST_PRACTICES.md)
- **Implementation Details**: [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
- **OpenAPI Spec**: [openapi-spec.json](../openapi-spec.json)
- **Official Docs**: https://docs.nestjs.com/openapi/introduction

## Next Steps

1. ✅ Run `npm run docs:generate` to generate initial docs
2. ✅ Run `npm run docs:view` to preview
3. ✅ Review generated files in `docs/`
4. ✅ Add decorators to controllers for better docs (optional)
5. ✅ Set up CI/CD for automation (optional)
6. ✅ Archive first version: `npm run docs:version`

---

**Questions?** Check the troubleshooting section or review the detailed guides linked above.
