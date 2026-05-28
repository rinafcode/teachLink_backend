# API Documentation Best Practices

This guide shows how to properly document your NestJS API endpoints using Swagger/OpenAPI decorators for automatic documentation generation.

## Table of Contents

1. [Basic Endpoint Documentation](#basic-endpoint-documentation)
2. [Request/Response Examples](#requestresponse-examples)
3. [Authentication](#authentication)
4. [Versioning](#versioning)
5. [Error Responses](#error-responses)
6. [Testing Documentation](#testing-documentation)

## Basic Endpoint Documentation

### Minimal Documentation

```typescript
import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('courses')
@ApiTags('Courses')  // Group endpoints in documentation
export class CoursesController {
  @Get()
  @ApiOperation({ 
    summary: 'List all courses',
    description: 'Retrieve a paginated list of all available courses'
  })
  @ApiResponse({
    status: 200,
    description: 'Courses found',
    schema: {
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/Course' }
        }
      }
    }
  })
  async listCourses() {
    return { success: true, data: [] };
  }
}
```

### Complete Documentation Example

```typescript
import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { CreateCourseDto } from './dto/create-course.dto';
import { CourseResponseDto } from './dto/course-response.dto';

@Controller('courses')
@ApiTags('Courses')
@ApiBearerAuth() // Indicates all endpoints need authentication
export class CoursesController {
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Create a new course',
    description: 'Create a new course with title, description, and pricing info. Requires authentication.',
  })
  @ApiResponse({
    status: 201,
    description: 'Course created successfully',
    type: CourseResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed - missing required fields',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required',
  })
  async createCourse(@Body() createCourseDto: CreateCourseDto) {
    return { success: true, data: { id: '123', ...createCourseDto } };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get course by ID' })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Course ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Course found',
    type: CourseResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Course not found',
  })
  async getCourse(@Param('id') id: string) {
    return { success: true, data: { id } };
  }

  @Get()
  @ApiOperation({ summary: 'List courses with filters' })
  @ApiQuery({
    name: 'page',
    type: Number,
    required: false,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    type: Number,
    required: false,
    description: 'Items per page (default: 20, max: 100)',
  })
  @ApiQuery({
    name: 'category',
    type: String,
    required: false,
    description: 'Filter by category',
  })
  @ApiResponse({
    status: 200,
    description: 'Courses found',
    schema: {
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/Course' }
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
          }
        }
      }
    }
  })
  async listCourses(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('category') category?: string,
  ) {
    return { success: true, data: [] };
  }
}
```

## Request/Response Examples

### Using DTOs for Automatic Documentation

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength, IsEnum, IsNumber, Min, IsUUID } from 'class-validator';

export enum CourseLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
}

export class CreateCourseDto {
  @ApiProperty({
    description: 'Course title',
    example: 'JavaScript Fundamentals',
    minLength: 3,
    maxLength: 200,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @ApiProperty({
    description: 'Course description',
    example: 'Learn JavaScript from the ground up',
    minLength: 10,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description: string;

  @ApiProperty({
    enum: CourseLevel,
    description: 'Difficulty level',
    example: CourseLevel.BEGINNER,
  })
  @IsEnum(CourseLevel)
  level: CourseLevel;

  @ApiProperty({
    description: 'Course price in cents',
    example: 9999,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({
    description: 'Course category',
    example: 'programming',
  })
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Instructor email',
    example: 'instructor@example.com',
  })
  @IsEmail()
  instructorEmail?: string;
}

export class CourseResponseDto {
  @ApiProperty({
    description: 'Course ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  id: string;

  @ApiProperty({
    description: 'Course title',
    example: 'JavaScript Fundamentals',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Course description',
    example: 'Learn JavaScript from the ground up',
  })
  @IsString()
  description: string;

  @ApiProperty({
    enum: CourseLevel,
    description: 'Difficulty level',
    example: CourseLevel.BEGINNER,
  })
  @IsEnum(CourseLevel)
  level: CourseLevel;

  @ApiProperty({
    description: 'Course price in cents',
    example: 9999,
  })
  @IsNumber()
  price: number;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2026-05-27T18:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2026-05-27T18:00:00.000Z',
  })
  updatedAt: Date;
}
```

## Authentication

### Documenting Protected Endpoints

```typescript
import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';

@Controller('me')
@ApiTags('Users')
@ApiBearerAuth() // Indicates this controller requires Bearer auth
export class MeController {
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Retrieve the profile of the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved',
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required - invalid or missing token',
  })
  async getProfile(@Request() req) {
    return req.user;
  }
}
```

### Multiple Authentication Methods

```typescript
@Controller('payment')
@ApiTags('Payments')
@ApiSecurity('api_key') // OR Bearer token OR API key
export class PaymentController {
  @Post('webhook')
  @ApiOperation({
    summary: 'Webhook for payment events',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed',
  })
  async handleWebhook() {
    return { success: true };
  }
}
```

## Versioning

### API Version Headers

```typescript
import { Controller, Get, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';

@Controller('courses')
@ApiTags('Courses')
export class CoursesController {
  @Get()
  @ApiOperation({ summary: 'List courses' })
  @ApiHeader({
    name: 'X-API-Version',
    description: 'API version (1 or 2)',
    required: false,
    example: '1',
  })
  async listCourses(@Headers('x-api-version') version: string = '1') {
    // Handle different versions
    return { success: true, apiVersion: version };
  }
}
```

## Error Responses

### Standard Error Schema

```typescript
import { ApiResponse, ApiProperty } from '@nestjs/swagger';

export class ErrorDto {
  @ApiProperty({
    description: 'Error code',
    example: 'VALIDATION_ERROR',
  })
  code: string;

  @ApiProperty({
    description: 'Human-readable error message',
    example: 'Validation failed',
  })
  message: string;

  @ApiProperty({
    description: 'Validation errors by field',
    example: { email: ['must be valid email'] },
  })
  errors?: Record<string, string[]>;
}

// In controller:
@Post('register')
@ApiResponse({
  status: 400,
  description: 'Validation failed',
  schema: {
    $ref: '#/components/schemas/ErrorDto',
  },
})
@ApiResponse({
  status: 409,
  description: 'User already exists',
  schema: {
    properties: {
      code: { type: 'string', example: 'USER_EXISTS' },
      message: { type: 'string', example: 'Email already registered' },
    },
  },
})
async register(@Body() dto: RegisterDto) {
  return { success: true };
}
```

## Testing Documentation

### Contract Testing

```typescript
import { Test } from '@nestjs/testing';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

describe('API Documentation', () => {
  it('should have all endpoints documented', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app = moduleRef.createNestApplication();
    const config = new DocumentBuilder()
      .setTitle('TeachLink API')
      .build();

    const document = SwaggerModule.createDocument(app, config);

    // Verify critical endpoints are documented
    const criticalPaths = [
      '/auth/login',
      '/auth/register',
      '/courses',
      '/users',
      '/payments/create-intent',
    ];

    criticalPaths.forEach((path) => {
      expect(document.paths[path]).toBeDefined();
    });
  });

  it('should have consistent error responses', async () => {
    // Verify error schemas are consistent across endpoints
    const spec = loadOpenAPISpec();
    const responses = Object.values(spec.paths).flatMap((pathItem) =>
      Object.values(pathItem).flatMap((operation) => Object.values(operation.responses || {})),
    );

    const errorResponses = responses.filter((r) => r.status >= 400);
    errorResponses.forEach((response) => {
      expect(response.schema).toBeDefined();
    });
  });
});
```

## Best Practices

### ✅ Do's

- ✅ Use `@ApiOperation` with meaningful summaries
- ✅ Include `@ApiResponse` for all possible status codes
- ✅ Use DTOs with `@ApiProperty` decorators
- ✅ Document query parameters with `@ApiQuery`
- ✅ Document path parameters with `@ApiParam`
- ✅ Document custom headers with `@ApiHeader`
- ✅ Use enums for fixed value sets
- ✅ Include examples in decorators
- ✅ Document authentication requirements
- ✅ Keep descriptions concise but informative

### ❌ Don'ts

- ❌ Don't skip documentation for "obvious" endpoints
- ❌ Don't use generic names like "Get" or "Post"
- ❌ Don't document only success responses
- ❌ Don't forget about pagination parameters
- ❌ Don't use "any" types in DTOs
- ❌ Don't leave decorators without examples
- ❌ Don't mix undocumented and documented endpoints

## Common Patterns

### Paginated List Response

```typescript
export class PaginatedResponseDto<T> {
  @ApiProperty()
  data: T[];

  @ApiProperty()
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Get()
@ApiResponse({
  status: 200,
  description: 'Paginated courses',
  schema: {
    $ref: '#/components/schemas/PaginatedResponseDto',
  },
})
async listCourses(@Query('page') page: number = 1, @Query('limit') limit: number = 20) {
  return {
    data: [],
    pagination: { page, limit, total: 0, totalPages: 0 },
  };
}
```

### Standardized Success/Error Envelope

```typescript
export class ApiResponseDto<T> {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty()
  data?: T;

  @ApiProperty()
  errors?: Record<string, string[]>;
}

// Use in all endpoints:
@ApiResponse({
  status: 200,
  schema: {
    $ref: '#/components/schemas/ApiResponseDto',
  },
})
```

## References

- [NestJS Swagger/OpenAPI Documentation](https://docs.nestjs.com/openapi/introduction)
- [OpenAPI 3.0 Specification](https://spec.openapis.org/oas/v3.0.0)
- [API Documentation Best Practices](https://swagger.io/resources/articles/best-practices-in-api-documentation/)
