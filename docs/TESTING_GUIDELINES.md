# TeachLink Backend Testing Guidelines

## Quick Start

This guide standardizes all testing practices in the TeachLink backend project. Use this as your primary reference for writing and refactoring tests.

---

## 1. Three Types of Tests

### Pattern A: NestJS Integration Tests (Controllers & Complex Services)

**Use when:** Testing controllers, services that need NestJS DI, guards, pipes, etc.

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { createMockRepository, createMockCachingService } from 'test/utils/mock-factories';

describe('UserController', () => {
  let controller: UserController;
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        UserService,
        {
          provide: 'UserRepository',
          useValue: createMockRepository(),
        },
        {
          provide: CachingService,
          useValue: createMockCachingService(),
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    service = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return user by id', async () => {
    // test implementation
  });
});
```

### Pattern B: Direct Service Instantiation (Unit Tests)

**Use when:** Testing service logic in isolation, no NestJS infrastructure needed

```typescript
import { createMockRepository, createMockCachingService } from 'test/utils/mock-factories';
import { Repository } from 'typeorm';

describe('UserService', () => {
  let service: UserService;
  let mockRepository: jest.Mocked<Repository<User>>;
  let mockCache: jest.Mocked<any>;

  beforeEach(() => {
    mockRepository = createMockRepository<User>();
    mockCache = createMockCachingService();
    service = new UserService(mockRepository, mockCache);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should find user by id', async () => {
    // Arrange
    const user = { id: '1', email: 'test@example.com' };
    mockRepository.findOne.mockResolvedValue(user);

    // Act
    const result = await service.findById('1');

    // Assert
    expect(result).toEqual(user);
    expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
  });
});
```

### Pattern C: Pure Function Testing (No Mocks)

**Use when:** Testing utilities, validators, formatters with no dependencies

```typescript
import { calculatePagination, validateEmail } from 'src/common/utils';

describe('calculatePagination', () => {
  it('should calculate correct offset', () => {
    const result = calculatePagination({ page: 2, limit: 10 });
    expect(result.offset).toBe(10);
  });

  it('should handle edge cases', () => {
    const result = calculatePagination({ page: 0, limit: 10 });
    expect(result.offset).toBe(0);
  });
});

describe('validateEmail', () => {
  it('should accept valid emails', () => {
    expect(validateEmail('test@example.com')).toBe(true);
  });

  it('should reject invalid emails', () => {
    expect(validateEmail('invalid')).toBe(false);
  });
});
```

---

## 2. Using Mock Factories

All reusable mocks are in [test/utils/mock-factories.ts](test/utils/mock-factories.ts)

### Available Factories

| Factory | Usage |
|---------|-------|
| `createMockRepository<T>()` | TypeORM repositories |
| `createMockCachingService()` | CachingService |
| `createMockRedisClient()` | Redis client (ioredis) |
| `createMockBullQueue()` | Bull job queues |
| `createMockHttpClient()` | HTTP requests (@nestjs/axios) |
| `createMockConfigService()` | Configuration |
| `createMockMailer()` | Email sending (nodemailer) |
| `createMockEventEmitter()` | Event emitters (EventEmitter2) |
| `createMockS3Client()` | AWS S3 |
| `createMockElasticsearchClient()` | Elasticsearch |
| `createMockExecutionContext()` | Guard testing |
| `createMockQueryBuilder()` | TypeORM QueryBuilder |

### Example: Repository Mock

```typescript
import { createMockRepository } from 'test/utils/mock-factories';

describe('UserService', () => {
  let mockRepo: jest.Mocked<Repository<User>>;

  beforeEach(() => {
    mockRepo = createMockRepository<User>();
  });

  it('should find user', async () => {
    // Set return value
    mockRepo.findOne.mockResolvedValue({ id: '1', email: 'test@example.com' });

    const result = await service.findById('1');

    expect(result.email).toBe('test@example.com');
    expect(mockRepo.findOne).toHaveBeenCalled();
  });
});
```

---

## 3. Mock Return Values

### For Async Functions (Promise-returning)

```typescript
// ✅ CORRECT: Use mockResolvedValue
mockService.fetchData.mockResolvedValue({ id: 1, name: 'Item' });

// ✅ For rejected promises
mockService.fetchData.mockRejectedValue(new Error('API Error'));

// ❌ AVOID: Using mockReturnValue with promises
mockService.fetchData.mockReturnValue(Promise.resolve({ id: 1 })); // Less clear
```

### For Sync Functions

```typescript
// ✅ CORRECT: Use mockReturnValue
mockService.validate.mockReturnValue(true);

// ✅ For multiple calls with different returns
mockService.validate
  .mockReturnValueOnce(true)
  .mockReturnValueOnce(false)
  .mockReturnValue(true);
```

### For Complex Logic

```typescript
// ✅ Use mockImplementation for custom logic
mockService.processData.mockImplementation((data) => {
  if (!data.id) throw new Error('Missing ID');
  return { ...data, processed: true };
});

// ✅ Async implementation
mockService.fetchAndProcess.mockImplementation(async (url) => {
  if (url.includes('error')) throw new Error('Invalid URL');
  return { data: 'result' };
});
```

---

## 4. Test Structure (AAA Pattern)

Always use Arrange-Act-Assert:

```typescript
describe('UserService.findById', () => {
  let service: UserService;
  let mockRepository: jest.Mocked<Repository<User>>;

  beforeEach(() => {
    mockRepository = createMockRepository<User>();
    service = new UserService(mockRepository);
  });

  it('should return user when found', async () => {
    // ─── ARRANGE: Set up test data and mocks ───────────────────────────────
    const user = { id: '1', email: 'john@example.com', role: 'ADMIN' };
    mockRepository.findOne.mockResolvedValue(user);

    // ─── ACT: Execute the code being tested ─────────────────────────────────
    const result = await service.findById('1');

    // ─── ASSERT: Verify the results ─────────────────────────────────────────
    expect(result).toEqual(user);
    expect(mockRepository.findOne).toHaveBeenCalledWith({
      where: { id: '1' },
    });
  });

  it('should throw NotFoundError when user not found', async () => {
    // Arrange
    mockRepository.findOne.mockResolvedValue(null);

    // Act & Assert
    await expect(service.findById('999')).rejects.toThrow('User not found');
  });
});
```

---

## 5. Assertion Best Practices

### Verifying Mock Calls

```typescript
// ✅ Basic call verification
expect(mockService.save).toHaveBeenCalled();
expect(mockService.save).toHaveBeenCalledTimes(1);
expect(mockService.save).toHaveBeenCalledWith(expectedUser);
expect(mockService.save).toHaveBeenCalledWith(
  expect.objectContaining({ id: '1', email: 'test@example.com' })
);

// ✅ Last call
expect(mockService.save).toHaveBeenLastCalledWith(expectedUser);

// ✅ Call order (multiple mocks)
expect(mockDB.beginTransaction).toHaveBeenCalledBefore(mockDB.commit);
```

### Resetting Mocks

```typescript
afterEach(() => {
  // Clear all mock data between tests
  jest.clearAllMocks();
});

// Or, if you want to keep the mock but reset call history
mockService.save.mockClear();
```

---

## 6. Common Testing Scenarios

### Scenario 1: Repository with QueryBuilder

```typescript
describe('UserService.findWithFilters', () => {
  let service: UserService;
  let mockRepository: jest.Mocked<Repository<User>>;

  beforeEach(() => {
    mockRepository = createMockRepository<User>();
    service = new UserService(mockRepository);
  });

  it('should apply where clause for role filter', async () => {
    // Create a spy on the query builder
    const mockQueryBuilder = createMockQueryBuilder();
    mockQueryBuilder.getMany.mockResolvedValue([
      { id: '1', role: 'ADMIN' },
    ]);
    mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

    const result = await service.findWithFilters({ role: 'ADMIN' });

    expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });
});
```

### Scenario 2: HTTP Requests

```typescript
describe('ExternalApiService', () => {
  let service: ExternalApiService;
  let mockHttp: jest.Mocked<HttpService>;

  beforeEach(() => {
    mockHttp = createMockHttpClient();
    service = new ExternalApiService(mockHttp);
  });

  it('should fetch data from external API', async () => {
    const data = { id: 1, title: 'Item' };
    mockHttp.get.mockReturnValue(
      of({
        data,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      })
    );

    const result = await firstValueFrom(service.fetchData());

    expect(result).toEqual(data);
    expect(mockHttp.get).toHaveBeenCalledWith('https://api.example.com/data');
  });

  it('should handle API errors', async () => {
    mockHttp.get.mockReturnValue(
      throwError(() => new Error('API Error'))
    );

    await expect(firstValueFrom(service.fetchData())).rejects.toThrow('API Error');
  });
});
```

### Scenario 3: Bull Queue Jobs

```typescript
describe('EmailService', () => {
  let service: EmailService;
  let mockQueue: jest.Mocked<Queue>;

  beforeEach(() => {
    mockQueue = createMockBullQueue();
    service = new EmailService(mockQueue);
  });

  it('should queue email job with correct payload', async () => {
    await service.sendEmail({
      to: 'user@example.com',
      subject: 'Test',
    });

    expect(mockQueue.add).toHaveBeenCalledWith(
      'send-email',
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Test',
      }),
      expect.any(Object)
    );
  });
});
```

### Scenario 4: Redis Operations

```typescript
describe('CacheManager', () => {
  let manager: CacheManager;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    mockRedis = createMockRedisClient();
    manager = new CacheManager(mockRedis);
  });

  it('should cache user data', async () => {
    const user = { id: '1', name: 'John' };
    await manager.setUser('1', user, 3600);

    expect(mockRedis.set).toHaveBeenCalledWith(
      'user:1',
      JSON.stringify(user),
      'EX',
      3600
    );
  });

  it('should retrieve cached user', async () => {
    mockRedis.get.mockResolvedValue(JSON.stringify({ id: '1', name: 'John' }));

    const result = await manager.getUser('1');

    expect(result).toEqual({ id: '1', name: 'John' });
  });
});
```

---

## 7. Test File Organization

### Recommended Structure

```typescript
// src/users/users.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { 
  createMockRepository, 
  createMockCachingService 
} from 'test/utils/mock-factories';

describe('UsersService', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // DECLARATIONS
  // ─────────────────────────────────────────────────────────────────────────

  let service: UsersService;
  let mockRepository: jest.Mocked<Repository<User>>;
  let mockCache: jest.Mocked<any>;

  // ─────────────────────────────────────────────────────────────────────────
  // SETUP & TEARDOWN
  // ─────────────────────────────────────────────────────────────────────────

  beforeEach(() => {
    mockRepository = createMockRepository<User>();
    mockCache = createMockCachingService();
    service = new UsersService(mockRepository, mockCache);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST SUITES
  // ─────────────────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should return user when found', async () => {
      // Arrange
      const user = { id: '1', email: 'test@example.com' };
      mockRepository.findOne.mockResolvedValue(user);

      // Act
      const result = await service.findById('1');

      // Assert
      expect(result).toEqual(user);
    });

    it('should throw NotFoundError when not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('999')).rejects.toThrow(
        'User not found'
      );
    });
  });

  describe('create', () => {
    it('should create and cache user', async () => {
      const user = { id: '1', email: 'new@example.com' };
      mockRepository.save.mockResolvedValue(user);

      const result = await service.create({ email: 'new@example.com' });

      expect(result).toEqual(user);
      expect(mockCache.set).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete user and invalidate cache', async () => {
      await service.delete('1');

      expect(mockRepository.delete).toHaveBeenCalledWith({ id: '1' });
      expect(mockCache.delete).toHaveBeenCalledWith('user:1');
    });
  });
});
```

---

## 8. Test Naming Convention

### Clear, Descriptive Test Names

```typescript
// ❌ BAD: Vague, doesn't describe what's being tested
it('works', () => {});
it('returns something', () => {});
it('should handle errors', () => {});

// ✅ GOOD: Specific, describes behavior
it('should return user by id when user exists', () => {});
it('should throw NotFoundError when user does not exist', () => {});
it('should throw ValidationError when email is invalid', () => {});
it('should cache result for 5 minutes after first retrieval', () => {});
it('should retry API call up to 3 times before failing', () => {});
```

---

## 9. Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:cov

# Run specific test file
npm run test -- src/users/users.service.spec.ts

# Run tests matching pattern
npm run test -- --testNamePattern="findById"

# Run CI-optimized tests
npm run test:ci
```

---

## 10. Migration Guide for Existing Tests

### Before (Inconsistent)

```typescript
describe('UserService', () => {
  let service: any;
  let repo: any;

  beforeEach(() => {
    repo = { findOne: jest.fn(), save: jest.fn() };
    service = new UserService(repo);
  });

  it('should find user', async () => {
    repo.findOne.mockResolvedValue({ id: '1' });
    expect(await service.findById('1')).toBeDefined();
  });
});
```

### After (Standardized)

```typescript
import { createMockRepository } from 'test/utils/mock-factories';
import { Repository } from 'typeorm';

describe('UserService', () => {
  let service: UserService;
  let mockRepository: jest.Mocked<Repository<User>>;

  beforeEach(() => {
    mockRepository = createMockRepository<User>();
    service = new UserService(mockRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return user by id when found', async () => {
    mockRepository.findOne.mockResolvedValue({ id: '1', email: 'test@example.com' });

    const result = await service.findById('1');

    expect(result).toEqual({ id: '1', email: 'test@example.com' });
    expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
  });
});
```

---

## 11. Troubleshooting

| Problem | Solution |
|---------|----------|
| `Cannot find module 'test/utils/mock-factories'` | Ensure `tsconfig.json` has `"baseUrl": "."` |
| Type errors with `jest.Mocked<T>` | Use `jest` types: `"jest"` in `tsconfig.json` compilerOptions.types |
| Mock not being called as expected | Check return types - use `mockResolvedValue` for async, `mockReturnValue` for sync |
| Tests pass locally but fail in CI | Add `afterEach(() => jest.clearAllMocks())` to reset state |
| Mock persists across tests | Create new mock in `beforeEach`, not at module scope |
| Tests are too slow | Reduce mock setup complexity, consider parallelization |

---

## 12. Quick Reference Card

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// JEST MOCK QUICK REFERENCE
// ═══════════════════════════════════════════════════════════════════════════

// Create typed mock
const mock: jest.Mocked<SomeService> = { /* methods */ } as jest.Mocked<SomeService>;

// Mock async return
mock.method.mockResolvedValue(value);
mock.method.mockRejectedValue(error);

// Mock sync return
mock.method.mockReturnValue(value);

// Mock with side effects
mock.method.mockImplementation((arg) => {
  if (arg === 'error') throw new Error('Bad input');
  return arg.toUpperCase();
});

// Verify calls
expect(mock.method).toHaveBeenCalled();
expect(mock.method).toHaveBeenCalledWith(expectedArg);
expect(mock.method).toHaveBeenCalledTimes(2);
expect(mock.method).toHaveBeenLastCalledWith(expectedArg);

// Chain multiple returns
mock.method
  .mockResolvedValueOnce(value1)
  .mockResolvedValueOnce(value2)
  .mockRejectedValueOnce(error);

// Reset/Clear
jest.clearAllMocks();      // Clear all mocks globally
mock.method.mockClear();   // Clear specific mock
mock.method.mockReset();   // Reset + remove implementations

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY QUICK REFERENCE
// ═══════════════════════════════════════════════════════════════════════════

import {
  createMockRepository,
  createMockCachingService,
  createMockRedisClient,
  createMockBullQueue,
  createMockHttpClient,
  createMockConfigService,
  createMockMailer,
  createMockEventEmitter,
  createMockQueryBuilder,
  createMockS3Client,
} from 'test/utils/mock-factories';

// ═══════════════════════════════════════════════════════════════════════════
// TEST STRUCTURE TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════

describe('ServiceName', () => {
  let service: ServiceName;
  let mockDependency: jest.Mocked<Dependency>;

  beforeEach(() => {
    mockDependency = createMock...();
    service = new ServiceName(mockDependency);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('methodName', () => {
    it('should do something specific', async () => {
      // Arrange
      mockDependency.method.mockResolvedValue(value);

      // Act
      const result = await service.methodName();

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockDependency.method).toHaveBeenCalledWith(expectedArg);
    });
  });
});
```

---

## 13. Additional Resources

- **Jest Documentation**: https://jestjs.io/docs/getting-started
- **NestJS Testing Guide**: https://docs.nestjs.com/fundamentals/testing
- **Testing Best Practices**: https://github.com/goldbergyoni/javascript-testing-best-practices
- **Mocking Strategies**: [docs/testing-standards.md](testing-standards.md)

---

## 14. Getting Help

For questions about testing:
1. Check [docs/testing-standards.md](testing-standards.md) for detailed mocking patterns
2. Review examples in `test/utils/mock-factories.ts`
3. Look at refactored test files as examples:
   - [src/users/users.service.spec.ts](src/users/users.service.spec.ts)
   - [src/caching/caching.service.spec.ts](src/caching/caching.service.spec.ts)
   - [src/media/media.service.spec.ts](src/media/media.service.spec.ts)

---

**Last Updated**: April 2026  
**Owner**: Engineering Team  
**Version**: 1.0.0
