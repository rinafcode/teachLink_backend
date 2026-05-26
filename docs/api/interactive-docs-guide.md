# Interactive API Documentation Guide

This guide explains how to access and use the interactive API documentation for TeachLink.

## Accessing Interactive Documentation

### Local Development

1. **Start the development server**:
   ```bash
   npm run start:dev
   ```

2. **Open Swagger UI** in your browser:
   ```
   http://localhost:3000/api/docs
   ```

### Production

Access the documentation at:
```
https://api.teachlink.com/api/docs
```

## Swagger UI Features

### 1. Interactive API Testing

Swagger UI allows you to test API endpoints directly from your browser:

#### Testing an Endpoint

1. **Navigate to the endpoint** you want to test (e.g., `POST /auth/login`)
2. **Click "Try it out"** button
3. **Fill in the request parameters**:
   - Path parameters
   - Query parameters
   - Request body (JSON)
4. **Click "Execute"**
5. **View the response**:
   - Response body
   - Response headers
   - HTTP status code
   - Curl command

#### Example: Testing Login

```
1. Find POST /auth/login
2. Click "Try it out"
3. Enter request body:
   {
     "email": "test@example.com",
     "password": "Test1234!"
   }
4. Click "Execute"
5. View response with access token
```

### 2. Authentication Management

#### Setting Up Bearer Token

1. Click the **"Authorize"** button (lock icon) at the top
2. Enter your JWT token:
   ```
   Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
3. Click **"Authorize"**
4. Click **"Close"**

Now all authenticated endpoints will use this token automatically.

#### Token Persistence

The documentation is configured with `persistAuthorization: true`, so your token will be saved in the browser's local storage and persist across page refreshes.

### 3. Schema Visualization

#### Request/Response Schemas

Each endpoint displays:
- **Request body schema** with field descriptions
- **Response schemas** for different status codes
- **Data types** and validation rules
- **Example values**

#### Model Definitions

Click on schema names (e.g., `RegisterDto`, `User`) to view:
- All available fields
- Data types
- Required fields
- Validation constraints
- Example values

### 4. Code Generation

#### Generate Client Code

For each endpoint, Swagger UI can generate client code in multiple languages:

1. **Execute a request**
2. **Scroll to "Responses" section**
3. **Find "Code_samples"** or use external tools

Supported languages:
- cURL
- JavaScript (Fetch, Axios)
- Python (Requests)
- Java (OkHttp, Unirest)
- PHP
- Ruby
- Go
- C#

#### Example: Generated cURL Command

```bash
curl -X POST "http://localhost:3000/auth/login" \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234!"
  }'
```

## OpenAPI Specification

### Download the Spec

The complete OpenAPI specification is available at:

- **YAML format**: `/api/docs-yaml`
- **JSON format**: `/api-docs.json`

### Import to API Tools

#### Postman

1. **Open Postman**
2. **Click "Import"**
3. **Select "Link"** tab
4. **Enter URL**: `http://localhost:3000/api-docs.json`
5. **Click "Continue"** and **"Import"**

This creates a complete Postman collection with all endpoints.

#### Insomnia

1. **Open Insomnia**
2. **Click "Import/Export"**
3. **Select "From URL"**
4. **Enter URL**: `http://localhost:3000/api-docs.json`
5. **Click "Import"**

#### HTTPie

```bash
# Install HTTPie
pip install httpie

# Make requests using the API
http POST http://localhost:3000/auth/login \
  email=test@example.com \
  password=Test1234!
```

## API Documentation Structure

### Tags

Endpoints are organized by tags:

- **auth** - Authentication and authorization
- **users** - User management
- **courses** - Course management
- **payments** - Payment processing
- **assessments** - Quizzes and assessments
- **notifications** - User notifications
- **search** - Search functionality
- **analytics** - Analytics and reporting

### Sorting

- **Tags**: Alphabetically sorted
- **Operations**: Alphabetically sorted within each tag

## Advanced Features

### 1. Request Validation

Swagger UI validates your requests against the schema before sending:

- **Required fields** are marked with `*`
- **Data type validation** (string, number, boolean, etc.)
- **Format validation** (email, date, uri, etc.)
- **Length constraints** (minLength, maxLength)
- **Pattern validation** (regex patterns)

### 2. Response Inspection

After executing a request, you can view:

#### Response Body
- **Pretty-printed JSON**
- **Syntax highlighting**
- **Collapsible nested objects**

#### Response Headers
- **Content-Type**
- **Cache-Control**
- **Rate limit headers**
- **Custom headers**

#### HTTP Status
- **Status code** (200, 201, 400, 401, etc.)
- **Status message** (OK, Created, Bad Request, etc.)
- **Response time**

### 3. Deep Linking

Each endpoint has a permanent URL:

```
http://localhost:3000/api/docs#/auth/login
http://localhost:3000/api/docs#/courses/create
```

Share these links with team members for quick navigation.

### 4. Dark Mode

Toggle between light and dark themes:
- Click the **theme icon** in the top right corner
- Choose **Light** or **Dark** mode

## Swagger Configuration

The Swagger UI is configured in `src/config/swagger.config.ts`:

```typescript
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('TeachLink API')
    .setDescription('TeachLink backend API documentation')
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'Authorization',
      description: 'Enter JWT token',
      in: 'header',
    }, 'access-token')
    .addTag('Auth', 'Authentication and authorization endpoints')
    .addTag('Users', 'User management endpoints')
    .addTag('Courses', 'Course management endpoints')
    .addTag('Payments', 'Payment processing endpoints')
    .addServer('http://localhost:3000', 'Local Development')
    .addServer('https://api.teachlink.com', 'Production')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'TeachLink API Docs',
  });
}
```

## Customizing Swagger Documentation

### Adding API Tags to Controllers

```typescript
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('users')
@Controller('users')
export class UsersController {
  @ApiOperation({ summary: 'Get all users' })
  @Get()
  findAll() {
    return this.usersService.findAll();
  }
}
```

### Adding Request/Response Examples

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ 
    example: 'john.doe@example.com',
    description: 'User email address'
  })
  email: string;

  @ApiProperty({ 
    example: 'StrongPass123!',
    description: 'User password (min 8 chars)'
  })
  password: string;
}
```

### Adding Security Requirements

```typescript
import { ApiBearerAuth } from '@nestjs/swagger';

@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Get('profile')
getProfile(@Request() req) {
  return req.user;
}
```

## Alternative Documentation Tools

### Redoc

For a more readable, documentation-focused view:

```bash
# Install Redoc CLI
npm install -g redoc-cli

# Generate static documentation
redoc-cli bundle http://localhost:3000/api-docs.json -o docs/api/redoc.html

# Serve documentation
redoc-cli serve http://localhost:3000/api-docs.json
```

Access at: `http://localhost:8080`

### Stoplight Elements

Modern API documentation with a beautiful UI:

```html
<!DOCTYPE html>
<html>
  <head>
    <title>TeachLink API Docs</title>
    <script src="https://unpkg.com/@stoplight/elements/web-components.min.js"></script>
    <link rel="stylesheet" href="https://unpkg.com/@stoplight/elements/styles.min.css">
  </head>
  <body>
    <elements-api
      apiDescriptionUrl="http://localhost:3000/api-docs.json"
      router="hash"
      layout="sidebar"
    />
  </body>
</html>
```

## Documentation Best Practices

### 1. Keep Documentation Updated

- Update DTOs with `@ApiProperty` decorators
- Add `@ApiOperation` to all controller methods
- Use `@ApiResponse` for different response types
- Include examples for all fields

### 2. Use Meaningful Descriptions

```typescript
// Good
@ApiOperation({ 
  summary: 'Create a new course',
  description: 'Creates a new course with the provided details. Only instructors and admins can create courses.'
})

// Bad
@ApiOperation({ summary: 'Create course' })
```

### 3. Document All Responses

```typescript
@Post()
@ApiResponse({ 
  status: 201, 
  description: 'Course created successfully',
  type: Course
})
@ApiResponse({ 
  status: 400, 
  description: 'Bad request - validation error' 
})
@ApiResponse({ 
  status: 401, 
  description: 'Unauthorized - invalid token' 
})
create(@Body() createCourseDto: CreateCourseDto) {
  return this.coursesService.create(createCourseDto);
}
```

### 4. Provide Realistic Examples

```typescript
@ApiProperty({ 
  example: 'john.doe@example.com',
  description: 'User email address'
})
email: string;

@ApiProperty({ 
  example: 49.99,
  description: 'Course price in USD',
  minimum: 0
})
price: number;
```

## Troubleshooting

### Issue: Swagger UI not loading

**Solution**:
```bash
# Check if server is running
npm run start:dev

# Verify endpoint
curl http://localhost:3000/api/docs

# Check for errors in console
```

### Issue: Authentication not working

**Solution**:
1. Ensure token format is correct: `Bearer <token>`
2. Check if token is expired
3. Verify token includes required claims
4. Check CORS settings

### Issue: Endpoints not showing

**Solution**:
1. Verify controller has `@ApiTags` decorator
2. Check if module is imported in app.module.ts
3. Ensure routes are properly configured
4. Restart development server

### Issue: Schemas not displaying

**Solution**:
1. Ensure DTOs have `@ApiProperty` decorators
2. Check TypeScript compilation
3. Verify imports in controller
4. Rebuild the application

## Additional Resources

- [Swagger UI Documentation](https://swagger.io/docs/open-source-tools/swagger-ui/)
- [OpenAPI Specification](https://swagger.io/specification/)
- [NestJS Swagger Integration](https://docs.nestjs.com/openapi/introduction)
- [API Design Best Practices](https://swagger.io/resources/articles/best-practices-in-api-design/)

## Next Steps

1. [Explore the API Documentation](http://localhost:3000/api/docs)
2. [Read the API Reference](./README.md)
3. [View Authentication Guide](./auth/auth-api.md)
4. [Download OpenAPI Spec](./openapi-spec.yaml.md)

---

**Need Help?** Contact us at api-support@teachlink.com
