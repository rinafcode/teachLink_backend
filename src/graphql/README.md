# GraphQL API Layer

A comprehensive GraphQL API implementation with advanced querying, mutations, real-time subscriptions, and N+1 query prevention.

## Features

- **Type-Safe Schema**: Auto-generated GraphQL schema with full TypeScript support
- **Advanced Querying**: Complex nested queries with filtering and search capabilities
- **Mutations**: Full CRUD operations with validation
- **Real-Time Subscriptions**: Live updates via WebSocket connections
- **N+1 Prevention**: DataLoader implementation for optimized database queries
- **Authentication**: JWT-based authentication with guards
- **GraphQL Playground**: Interactive API explorer for development

## Architecture

### Core Components

1. **GraphQL Module** (`graphql.module.ts`)
   - Configures Apollo Server with NestJS
   - Sets up subscriptions and playground
   - Manages resolver and service dependencies

2. **Resolvers**
   - `query.resolver.ts` - Read operations
   - `mutation.resolver.ts` - Write operations
   - `subscription.resolver.ts` - Real-time updates
   - Field resolvers for nested data (User, Course, Assessment)

3. **DataLoader Service** (`dataloader.service.ts`)
   - Batches database queries
   - Caches results within request scope
   - Prevents N+1 query problems

4. **Types & Inputs**
   - GraphQL object types for entities
   - Input types for mutations with validation
   - Enum registrations

## Usage

### Starting the Server

The GraphQL API is automatically available at:
- **Endpoint**: `http://localhost:3000/graphql`
- **Playground**: `http://localhost:3000/graphql` (in browser)
- **Subscriptions**: `ws://localhost:3000/graphql`

### Example Queries

#### Get User with Courses
```graphql
query GetUser($id: ID!) {
  user(id: $id) {
    id
    email
    firstName
    lastName
    role
    courses {
      id
      title
      price
      status
    }
  }
}
```

#### Search Courses
```graphql
query SearchCourses($filter: CourseFilterInput) {
  courses(filter: $filter) {
    id
    title
    description
    price
    instructor {
      id
      firstName
      lastName
    }
  }
}
```

#### Get Current User
```graphql
query Me {
  me {
    id
    email
    firstName
    lastName
    role
    courses {
      id
      title
    }
  }
}
```

### Example Mutations

#### Create User
```graphql
mutation CreateUser($input: CreateUserInput!) {
  createUser(input: $input) {
    id
    email
    firstName
    lastName
    role
  }
}
```

Variables:
```json
{
  "input": {
    "email": "user@example.com",
    "password": "securePassword123",
    "firstName": "John",
    "lastName": "Doe",
    "role": "STUDENT"
  }
}
```

#### Create Course
```graphql
mutation CreateCourse($input: CreateCourseInput!) {
  createCourse(input: $input) {
    id
    title
    description
    price
    instructor {
      id
      firstName
      lastName
    }
  }
}
```

Variables:
```json
{
  "input": {
    "title": "Advanced GraphQL",
    "description": "Learn GraphQL from scratch",
    "price": 49.99,
    "instructorId": "user-uuid-here"
  }
}
```

#### Update Course
```graphql
mutation UpdateCourse($id: ID!, $input: UpdateCourseInput!) {
  updateCourse(id: $id, input: $input) {
    id
    title
    status
  }
}
```

### Example Subscriptions

#### Subscribe to New Courses
```graphql
subscription OnCourseCreated {
  courseCreated {
    id
    title
    price
    instructor {
      firstName
      lastName
    }
  }
}
```

#### Subscribe to User Updates
```graphql
subscription OnUserUpdated {
  userUpdated {
    id
    email
    firstName
    lastName
    status
  }
}
```

#### Subscribe to Assessment Changes
```graphql
subscription OnAssessmentCreated {
  assessmentCreated {
    id
    title
    durationMinutes
    questions {
      id
      text
      type
    }
  }
}
```

## Authentication

Most queries and all mutations require JWT authentication. Include the token in the HTTP headers:

```json
{
  "Authorization": "Bearer YOUR_JWT_TOKEN"
}
```

In GraphQL Playground, set headers in the bottom-left panel:
```json
{
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## N+1 Query Prevention

The DataLoader service automatically batches and caches database queries:

### Without DataLoader (N+1 Problem)
```
Query: Get 10 courses with instructors
- 1 query to fetch courses
- 10 queries to fetch each instructor
= 11 total queries
```

### With DataLoader (Optimized)
```
Query: Get 10 courses with instructors
- 1 query to fetch courses
- 1 batched query to fetch all instructors
= 2 total queries
```

### How It Works

1. **Request Scope**: New DataLoaders created per request
2. **Batching**: Multiple load() calls batched into single query
3. **Caching**: Results cached within request to avoid duplicate queries
4. **Automatic**: Field resolvers use loaders transparently

## Schema Generation

The GraphQL schema is auto-generated from TypeScript decorators:

- Schema file: `src/graphql/schema/schema.graphql`
- Auto-updated on server start
- Sorted alphabetically for consistency

## Error Handling

Errors are formatted with:
- `message`: Human-readable error description
- `code`: Error code for client handling
- `path`: GraphQL query path where error occurred

Example error response:
```json
{
  "errors": [
    {
      "message": "User not found",
      "code": "NOT_FOUND",
      "path": ["user"]
    }
  ]
}
```

## Performance Optimization

1. **DataLoader**: Prevents N+1 queries
2. **Field-Level Resolution**: Only requested fields are resolved
3. **Query Complexity**: Can be limited to prevent abuse
4. **Caching**: Redis integration for query results
5. **Batching**: Multiple operations in single request

## Real-Time Features

Subscriptions use WebSocket for real-time updates:

- **PubSub**: In-memory pub/sub for development
- **Redis PubSub**: Recommended for production (scalable)
- **Event Types**: Create, Update, Delete for all entities

## Testing

### Using GraphQL Playground

1. Navigate to `http://localhost:3000/graphql`
2. Use the Docs tab to explore schema
3. Write queries in the editor
4. Set variables in the bottom-left panel
5. Add authentication headers if needed
6. Click Play to execute

### Programmatic Testing

```typescript
import { gql } from 'graphql-request';

const query = gql`
  query GetCourses {
    courses {
      id
      title
    }
  }
`;

const result = await client.request(query);
```

## Best Practices

1. **Always use DataLoaders** for related entities
2. **Request only needed fields** to optimize performance
3. **Use fragments** for reusable field selections
4. **Implement pagination** for large result sets
5. **Add field-level authorization** for sensitive data
6. **Monitor query complexity** to prevent abuse
7. **Use subscriptions sparingly** to avoid overhead

## Extending the API

### Adding New Entity

1. Create GraphQL type in `types/`
2. Create input types in `inputs/`
3. Add queries to `query.resolver.ts`
4. Add mutations to `mutation.resolver.ts`
5. Add subscriptions to `subscription.resolver.ts`
6. Create field resolver if needed
7. Add DataLoader in `dataloader.service.ts`

### Example: Adding Comments

```typescript
// types/comment.type.ts
@ObjectType()
export class CommentType {
  @Field(() => ID)
  id: string;

  @Field()
  content: string;

  @Field(() => UserType)
  author: UserType;
}

// Add to query.resolver.ts
@Query(() => [CommentType])
async comments(): Promise<CommentType[]> {
  return this.commentsService.findAll();
}

// Add to mutation.resolver.ts
@Mutation(() => CommentType)
async createComment(@Args('input') input: CreateCommentInput) {
  const comment = await this.commentsService.create(input);
  await this.pubSub.publish('commentCreated', { commentCreated: comment });
  return comment;
}
```

## Troubleshooting

### Schema Not Generating
- Check TypeScript decorators are correct
- Ensure all types are imported in module
- Verify `autoSchemaFile` path is writable

### N+1 Queries Still Occurring
- Verify DataLoader is in context
- Check field resolver uses loader
- Ensure loader is created per request

### Subscriptions Not Working
- Check WebSocket connection
- Verify PubSub is injected correctly
- Ensure subscription resolver returns asyncIterator

### Authentication Errors
- Verify JWT token is valid
- Check Authorization header format
- Ensure JwtAuthGuard is applied

## Production Considerations

1. **Replace in-memory PubSub** with Redis for horizontal scaling
2. **Add query complexity limits** to prevent abuse
3. **Implement rate limiting** on mutations
4. **Enable query depth limiting**
5. **Add field-level caching** with Redis
6. **Monitor query performance** with APM tools
7. **Disable playground** in production
8. **Use persisted queries** for security

## Resources

- [NestJS GraphQL Documentation](https://docs.nestjs.com/graphql/quick-start)
- [Apollo Server Documentation](https://www.apollographql.com/docs/apollo-server/)
- [DataLoader Documentation](https://github.com/graphql/dataloader)
- [GraphQL Best Practices](https://graphql.org/learn/best-practices/)
