# Testing Standards & Mocking Patterns

## Overview

This document standardizes mocking approaches across the TeachLink backend codebase. Consistency improves maintainability, readability, and test reliability.

---

## 1. Core Principles

### 1.1 Mock Hierarchy (Priority Order)

1. **NestJS `Test.createTestingModule()`** - Use for integration tests with real DI container
   - Leverage NestJS providers, guards, interceptors
   - Provides realistic module compilation
   
2. **Manual Mock Objects** - Use for unit tests of services/utilities
   - Fast, explicit control
   - Ideal for isolated component testing
   
3. **No Mocks** - Use for pure utility/helper functions
   - No external dependencies
   - Simple, deterministic logic

### 1.2 When to Mock vs. Test

| Scenario | Approach | Reason |
|----------|----------|--------|
| External Service (API, DB) | **Mock** | Isolate test environment |
| NestJS Infrastructure (Guards, Pipes) | **Mock with createTestingModule** | Need DI container |
| Database Repository | **Mock** | Prevent test DB coupling |
| Third-party Library | **Mock** | Control behavior, avoid version sensitivity |
| Pure Function | **No Mock** | Test actual behavior |
| Service Method (dependency has mock) | **Partial Mock** | Mock dependencies, test method logic |

---

## 2. Mocking Patterns

### 2.1 Pattern A: NestJS Testing Module (Controllers & Complex Services)

**When to use:** Controllers, services that need NestJS infrastructure, dependency injection

```typescript
describe('UserController', () => {
  let controller: UserController;
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        UserService,
        {
          provide: 'DatabaseRepository',
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

  it('should return user by id', async () => {
    const user = { id: '1', name: 'John' };
    // test implementation
  });
});
```

**Advantages:**
- Uses real NestJS DI
- Tests actual service/controller integration
- Detects provider configuration errors

### 2.2 Pattern B: Direct Service Instantiation (Unit Tests)

**When to use:** Pure service logic testing, isolated units, no NestJS infrastructure needed

```typescript
describe('UserService', () => {
  let service: UserService;
  let mockRepository: jest.Mocked<UserRepository>;
  let mockCache: jest.Mocked<CachingService>;

  beforeEach(() => {
    mockRepository = createMockRepository();
    mockCache = createMockCachingService();
    service = new UserService(mockRepository, mockCache);
  });

  it('should find user by id', async () => {
    mockRepository.findById.mockResolvedValue({ id: '1', name: 'John' });
    
    const result = await service.findById('1');
    
    expect(result).toEqual({ id: '1', name: 'John' });
    expect(mockRepository.findById).toHaveBeenCalledWith('1');
  });
});
```

**Advantages:**
- Faster execution
- Simpler setup
- Clear, explicit mocks
- Easier to test error scenarios

### 2.3 Pattern C: Pure Function Testing (No Mocks)

**When to use:** Utilities, validators, formatters, pure functions

```typescript
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
```

**Advantages:**
- No mock setup needed
- Fastest execution
- Tests actual behavior without abstraction

---

## 3. Mock Factory Functions

Use provided mock factories in `test/utils/mock-factories.ts`:

```typescript
// Examples
const mockRepository = createMockRepository<User>();
const mockCache = createMockCachingService();
const mockRedisClient = createMockRedisClient();
const mockQueue = createMockBullQueue();
const mockHttpClient = createMockHttpClient();
```

See [Mock Factories Guide](#5-mock-factories-guide) below.

---

## 4. Jest Mock Best Practices

### 4.1 Typing Mocks

Always use `jest.Mocked<T>` for type safety:

```typescript
// ❌ AVOID: Untyped mock
let mockService: any;

// ✅ CORRECT: Typed mock
let mockService: jest.Mocked<UserService>;
```

### 4.2 Setting Up Mock Return Values

```typescript
// ✅ Use mockResolvedValue for async functions
mockService.findById.mockResolvedValue({ id: '1' });

// ✅ Use mockReturnValue for sync functions
mockService.validate.mockReturnValue(true);

// ✅ Use mockImplementation for complex logic
mockService.processData.mockImplementation((data) => {
  return { ...data, processed: true };
});

// ❌ AVOID: Inconsistent return types
mockService.findById = { then: () => {} } as any;
```

### 4.3 Asserting Mock Calls

```typescript
// ✅ CORRECT: Verify calls
expect(mockService.findById).toHaveBeenCalledWith('1');
expect(mockService.findById).toHaveBeenCalledTimes(1);

// ✅ Clear mocks between tests
afterEach(() => {
  jest.clearAllMocks();
});
```

### 4.4 Mock Reset Strategy

```typescript
beforeEach(() => {
  // Option 1: Create fresh mocks for each test
  mockService = createMockUserService();

  // Option 2: Clear existing mocks
  jest.clearAllMocks();
});
```

---

## 5. Mock Factories Guide

### 5.1 Available Factories

Located in `test/utils/mock-factories.ts`:

| Factory | Returns | Common Methods |
|---------|---------|-----------------|
| `createMockRepository<T>()` | `jest.Mocked<Repository<T>>` | `find`, `findOne`, `create`, `save`, `delete` |
| `createMockCachingService()` | `jest.Mocked<CachingService>` | `get`, `set`, `delete`, `getOrSet` |
| `createMockRedisClient()` | `jest.Mocked<Redis>` | `get`, `set`, `del`, `pipeline`, `scan` |
| `createMockBullQueue()` | `jest.Mocked<Queue>` | `add`, `process`, `remove` |
| `createMockHttpClient()` | `jest.Mocked<HttpService>` | `get`, `post`, `put`, `delete` |
| `createMockConfigService()` | `jest.Mocked<ConfigService>` | `get`, `getOrThrow` |
| `createMockQueryBuilder()` | `jest.Mocked<QueryBuilder>` | Chainable TypeORM methods |

### 5.2 Using Mock Factories

```typescript
import { createMockRepository, createMockCachingService } from 'test/utils/mock-factories';

describe('UserService', () => {
  let service: UserService;
  let mockRepository: jest.Mocked<UserRepository>;
  let mockCache: jest.Mocked<CachingService>;

  beforeEach(() => {
    mockRepository = createMockRepository<User>();
    mockCache = createMockCachingService();
    service = new UserService(mockRepository, mockCache);
  });

  it('should work', () => {
    // Tests have access to typed, fully mocked services
  });
});
```

---

## 6. Common Testing Scenarios

### 6.1 Repository with QueryBuilder

```typescript
describe('UserService.findAll', () => {
  let service: UserService;
  let mockRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    mockRepository = createMockRepository<User>();
    service = new UserService(mockRepository);
  });

  it('should filter by role', async () => {
    const users = [{ id: '1', role: 'ADMIN' }];
    
    mockRepository.createQueryBuilder().mockReturnValue(
      createMockQueryBuilder(users)
    );

    const result = await service.findAll({ role: 'ADMIN' });
    
    expect(result).toEqual(users);
  });
});
```

### 6.2 HTTP Requests

```typescript
describe('ExternalApiService', () => {
  let service: ExternalApiService;
  let mockHttp: jest.Mocked<HttpService>;

  beforeEach(() => {
    mockHttp = createMockHttpClient();
    service = new ExternalApiService(mockHttp);
  });

  it('should fetch external data', async () => {
    const data = { id: 1, title: 'Item' };
    
    mockHttp.get.mockReturnValue(
      of({ data, status: 200, statusText: 'OK', headers: {}, config: {} as any })
    );

    const result = await firstValueFrom(service.fetchData());
    
    expect(result).toEqual(data);
    expect(mockHttp.get).toHaveBeenCalledWith('https://api.example.com/data');
  });
});
```

### 6.3 Bull Queue Jobs

```typescript
describe('EmailQueue', () => {
  let service: EmailService;
  let mockQueue: jest.Mocked<Queue>;

  beforeEach(() => {
    mockQueue = createMockBullQueue();
    service = new EmailService(mockQueue);
  });

  it('should queue email job', async () => {
    await service.sendEmail({ to: 'test@example.com', subject: 'Test' });

    expect(mockQueue.add).toHaveBeenCalledWith(
      'send-email',
      expect.objectContaining({ to: 'test@example.com' }),
      expect.any(Object)
    );
  });
});
```

---

## 7. Test Organization

### 7.1 Test File Structure

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { createMockRepository } from 'test/utils/mock-factories';

describe('UserService', () => {
  // ─── Declarations ──────────────────────────────────────────────
  let service: UserService;
  let mockRepository: jest.Mocked<UserRepository>;

  // ─── Setup ─────────────────────────────────────────────────────
  beforeEach(async () => {
    mockRepository = createMockRepository<User>();
    service = new UserService(mockRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── Happy Path ────────────────────────────────────────────────
  describe('findById', () => {
    it('should return user when found', async () => {
      // Arrange
      mockRepository.findOne.mockResolvedValue({ id: '1', name: 'John' });

      // Act
      const result = await service.findById('1');

      // Assert
      expect(result).toEqual({ id: '1', name: 'John' });
    });
  });

  // ─── Error Handling ────────────────────────────────────────────
  describe('findById error handling', () => {
    it('should throw when user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('999')).rejects.toThrow('User not found');
    });
  });
});
```

### 7.2 Test Naming Convention

```typescript
// ❌ AVOID: Vague names
it('works', () => {});
it('returns something', () => {});

// ✅ CORRECT: Descriptive names
it('should return user by id when user exists', () => {});
it('should throw NotFoundError when user does not exist', () => {});
it('should cache result for 5 minutes', () => {});
```

---

## 8. Migration Guide

### 8.1 Migrating Old Tests

**Before (Inconsistent):**
```typescript
describe('UserService', () => {
  let service: any;
  let repo: any;

  beforeEach(() => {
    repo = { findOne: jest.fn() };
    service = new UserService(repo);
  });

  it('should find user', async () => {
    repo.findOne.mockResolvedValue({ id: '1' });
    expect(await service.findById('1')).toBeDefined();
  });
});
```

**After (Standardized):**
```typescript
import { createMockRepository } from 'test/utils/mock-factories';

describe('UserService', () => {
  let service: UserService;
  let mockRepository: jest.Mocked<UserRepository>;

  beforeEach(async () => {
    mockRepository = createMockRepository<User>();
    service = new UserService(mockRepository);
  });

  it('should return user by id when found', async () => {
    mockRepository.findOne.mockResolvedValue({ id: '1', name: 'John' });

    const result = await service.findById('1');

    expect(result).toEqual({ id: '1', name: 'John' });
    expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
  });
});
```

### 8.2 Step-by-Step Refactoring

1. Identify the service being tested
2. Choose appropriate pattern (NestJS module vs. direct instantiation)
3. Replace manual mocks with factory functions
4. Add type annotations (`jest.Mocked<T>`)
5. Verify test still passes with `npm run test`
6. Update other tests following same pattern in the same file

---

## 9. Troubleshooting

| Issue | Solution |
|-------|----------|
| `Cannot find name 'jest'` | Ensure `jest` types are in `tsconfig.json` `compilerOptions.types` |
| Mock not being called as expected | Check return types - use `mockResolvedValue` for async, `mockReturnValue` for sync |
| Type errors with mocks | Use `as jest.Mocked<T>` or create mock with factory |
| Tests passing locally but failing in CI | Check mock reset - add `afterEach(() => jest.clearAllMocks())` |
| Mock persists across tests | Create new mock in `beforeEach`, not in module scope |

---

## 10. Quick Reference Checklist

- [ ] Use `jest.Mocked<T>` for all mock types
- [ ] Import mock factories from `test/utils/mock-factories.ts`
- [ ] Choose pattern A (NestJS), B (direct), or C (no mock)
- [ ] Use `mockResolvedValue` for async methods
- [ ] Use `mockReturnValue` for sync methods
- [ ] Assert mock calls with `toHaveBeenCalledWith`
- [ ] Clear mocks in `afterEach`
- [ ] Name tests descriptively with "should..."
- [ ] Include arrange-act-assert comments for complex tests
- [ ] Keep tests focused on single concern

---

## 11. Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [NestJS Testing Guide](https://docs.nestjs.com/fundamentals/testing)
- [TypeORM Testing](https://typeorm.io/develop/testing)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
