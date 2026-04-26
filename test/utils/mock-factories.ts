/**
 * Mock Factory Functions
 *
 * Provides standardized, reusable mock objects for common dependencies.
 * These factories ensure consistency across the test suite.
 *
 * Usage:
 *   import { createMockRepository, createMockCachingService } from 'test/utils/mock-factories';
 *
 *   const mockRepo = createMockRepository<User>();
 *   const mockCache = createMockCachingService();
 */

import { Repository, SelectQueryBuilder, UpdateResult, DeleteResult } from 'typeorm';
import { DeepPartial } from 'typeorm/common/DeepPartial';
import Redis from 'ioredis';
import { Queue, Job, JobOptions } from 'bull';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';

// ─────────────────────────────────────────────────────────────────────────────
// Generic Repository Mock Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a fully mocked TypeORM Repository
 *
 * @example
 *   const mockRepo = createMockRepository<User>();
 *   mockRepo.find.mockResolvedValue([{ id: '1', name: 'John' }]);
 */
export function createMockRepository<T>(): jest.Mocked<Repository<T>> {
  return {
    // ─── Retrieval Methods ──────────────────────────────────────────────────
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    findOneOrFail: jest.fn(),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    count: jest.fn().mockResolvedValue(0),
    exist: jest.fn().mockResolvedValue(false),

    // ─── Mutation Methods ───────────────────────────────────────────────────
    create: jest.fn((data: DeepPartial<T>) => data as T),
    save: jest.fn().mockImplementation(async (data: T | T[]) => data),
    insert: jest.fn().mockResolvedValue({ generatedMaps: [], raw: [], affected: 1 }),
    update: jest.fn().mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] } as UpdateResult),
    delete: jest.fn().mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] } as DeleteResult),
    remove: jest.fn(),
    clear: jest.fn(),

    // ─── Query Building ────────────────────────────────────────────────────
    createQueryBuilder: jest.fn(() => createMockQueryBuilder<T>()),

    // ─── Transaction & Advanced ────────────────────────────────────────────
    transaction: jest.fn(),
    query: jest.fn(),
    increment: jest.fn(),
    decrement: jest.fn(),

    // ─── Metadata ──────────────────────────────────────────────────────────
    target: Object as any,
    manager: {} as any,
    metadata: {} as any,
  } as unknown as jest.Mocked<Repository<T>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// QueryBuilder Mock Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a fully mocked TypeORM QueryBuilder
 *
 * @example
 *   const qb = createMockQueryBuilder<User>();
 *   qb.andWhere.mockReturnThis();
 *   qb.getMany.mockResolvedValue([{ id: '1' }]);
 */
export function createMockQueryBuilder<T>(): jest.Mocked<SelectQueryBuilder<T>> {
  return {
    // ─── Selection ─────────────────────────────────────────────────────────
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    distinct: jest.fn().mockReturnThis(),

    // ─── Filtering ─────────────────────────────────────────────────────────
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),

    // ─── Ordering & Pagination ────────────────────────────────────────────
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),

    // ─── Grouping ──────────────────────────────────────────────────────────
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    having: jest.fn().mockReturnThis(),

    // ─── Execution ─────────────────────────────────────────────────────────
    getOne: jest.fn().mockResolvedValue(null),
    getMany: jest.fn().mockResolvedValue([]),
    getCount: jest.fn().mockResolvedValue(0),
    getRawOne: jest.fn().mockResolvedValue(null),
    getRawMany: jest.fn().mockResolvedValue([]),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),

    // ─── Metadata ──────────────────────────────────────────────────────────
    alias: 'entity',
    expressionMap: {} as any,
    connection: {} as any,
  } as unknown as jest.Mocked<SelectQueryBuilder<T>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// CachingService Mock Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a mock CachingService with all standard methods
 *
 * @example
 *   const mockCache = createMockCachingService();
 *   mockCache.get.mockResolvedValue({ data: 'cached' });
 */
export function createMockCachingService(): jest.Mocked<any> {
  return {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(undefined),
    getOrSet: jest.fn().mockImplementation(async (_key: string, handler: any) => handler()),
    delete: jest.fn().mockResolvedValue(undefined),
    deleteMany: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(false),
    clear: jest.fn().mockResolvedValue(undefined),
    setMany: jest.fn().mockResolvedValue(undefined),
    getMany: jest.fn().mockResolvedValue([]),
    incrementCounter: jest.fn().mockResolvedValue(1),
    decrementCounter: jest.fn().mockResolvedValue(0),
    getCounter: jest.fn().mockResolvedValue(0),
    setExpiration: jest.fn().mockResolvedValue(true),
    getExpiration: jest.fn().mockResolvedValue(-1),
  } as jest.Mocked<any>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Redis Client Mock Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a mock Redis client matching ioredis API
 *
 * @example
 *   const mockRedis = createMockRedisClient();
 *   mockRedis.get.mockResolvedValue('cached-value');
 */
export function createMockRedisClient(): jest.Mocked<Redis> {
  const pipelineResult = {
    get: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    del: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  };

  return {
    // ─── String Commands ────────────────────────────────────────────────────
    get: jest.fn(),
    set: jest.fn(),
    getex: jest.fn(),
    getdel: jest.fn(),
    append: jest.fn(),
    strlen: jest.fn(),

    // ─── Hash Commands ──────────────────────────────────────────────────────
    hget: jest.fn(),
    hset: jest.fn(),
    hdel: jest.fn(),
    hgetall: jest.fn(),
    hkeys: jest.fn(),
    hvals: jest.fn(),
    hexists: jest.fn(),
    hlen: jest.fn(),

    // ─── List Commands ──────────────────────────────────────────────────────
    lpush: jest.fn(),
    rpush: jest.fn(),
    lpop: jest.fn(),
    rpop: jest.fn(),
    llen: jest.fn(),
    lrange: jest.fn(),

    // ─── Set Commands ───────────────────────────────────────────────────────
    sadd: jest.fn(),
    srem: jest.fn(),
    smembers: jest.fn(),
    scard: jest.fn(),
    sismember: jest.fn(),

    // ─── Sorted Set Commands ────────────────────────────────────────────────
    zadd: jest.fn(),
    zrem: jest.fn(),
    zrange: jest.fn(),
    zcard: jest.fn(),
    zscore: jest.fn(),

    // ─── Key Commands ───────────────────────────────────────────────────────
    del: jest.fn(),
    unlink: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    expireat: jest.fn(),
    ttl: jest.fn(),
    pttl: jest.fn(),
    keys: jest.fn(),
    scan: jest.fn(),
    randomkey: jest.fn(),
    rename: jest.fn(),
    type: jest.fn(),

    // ─── Script Commands ────────────────────────────────────────────────────
    eval: jest.fn(),
    evalsha: jest.fn(),
    script: jest.fn(),

    // ─── Transaction Commands ───────────────────────────────────────────────
    multi: jest.fn().mockReturnThis(),
    exec: jest.fn(),
    discard: jest.fn(),
    watch: jest.fn(),
    unwatch: jest.fn(),

    // ─── Server Commands ────────────────────────────────────────────────────
    ping: jest.fn().mockResolvedValue('PONG'),
    echo: jest.fn(),
    info: jest.fn(),
    dbsize: jest.fn(),
    flushdb: jest.fn(),
    flushall: jest.fn(),
    select: jest.fn(),
    auth: jest.fn(),

    // ─── Batch Commands ────────────────────────────────────────────────────
    mget: jest.fn(),
    mset: jest.fn(),
    pipeline: jest.fn().mockReturnValue(pipelineResult),

    // ─── Counter Commands ───────────────────────────────────────────────────
    incr: jest.fn(),
    incrby: jest.fn(),
    incrbyfloat: jest.fn(),
    decr: jest.fn(),
    decrby: jest.fn(),

    // ─── Connection ──────────────────────────────────────────────────────────
    connect: jest.fn(),
    quit: jest.fn().mockResolvedValue('OK'),
    disconnect: jest.fn(),
    status: 'ready' as any,
  } as unknown as jest.Mocked<Redis>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bull Queue Mock Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a mock Bull Queue for job processing
 *
 * @example
 *   const mockQueue = createMockBullQueue();
 *   mockQueue.add.mockResolvedValue({ id: '1' } as Job);
 */
export function createMockBullQueue<T = any>(): jest.Mocked<Queue<T>> {
  return {
    // ─── Job Methods ────────────────────────────────────────────────────────
    add: jest.fn(),
    process: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    off: jest.fn(),
    removeAllListeners: jest.fn(),

    // ─── Query Methods ──────────────────────────────────────────────────────
    getJob: jest.fn(),
    getJobs: jest.fn().mockResolvedValue([]),
    getJobCounts: jest.fn().mockResolvedValue({
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      waiting: 0,
      paused: 0,
      repeat: 0,
    }),
    getCompleted: jest.fn().mockResolvedValue([]),
    getActive: jest.fn().mockResolvedValue([]),
    getFailed: jest.fn().mockResolvedValue([]),
    getDelayed: jest.fn().mockResolvedValue([]),
    getWaiting: jest.fn().mockResolvedValue([]),
    getPaused: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),

    // ─── State Methods ───────────────────────────────────────────────────────
    empty: jest.fn().mockResolvedValue(undefined),
    clean: jest.fn().mockResolvedValue([]),
    pause: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),

    // ─── Removal Methods ────────────────────────────────────────────────────
    remove: jest.fn(),
    drain: jest.fn().mockResolvedValue(undefined),

    // ─── Repeat Methods ─────────────────────────────────────────────────────
    removeRepeatableByKey: jest.fn(),
    getRepeatableCount: jest.fn().mockResolvedValue(0),

    // ─── Metadata ────────────────────────────────────────────────────────────
    name: 'mock-queue' as string,
    client: {} as any,
    jobsOpts: {} as any,
  } as unknown as jest.Mocked<Queue<T>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// HttpService Mock Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a mock HttpService for HTTP calls
 *
 * @example
 *   const mockHttp = createMockHttpClient();
 *   mockHttp.get.mockReturnValue(of({ data: { id: 1 } }));
 */
export function createMockHttpClient(): jest.Mocked<HttpService> {
  const mockResponse = {
    data: {},
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as any,
  };

  return {
    get: jest.fn().mockReturnValue(of(mockResponse)),
    post: jest.fn().mockReturnValue(of(mockResponse)),
    put: jest.fn().mockReturnValue(of(mockResponse)),
    patch: jest.fn().mockReturnValue(of(mockResponse)),
    delete: jest.fn().mockReturnValue(of(mockResponse)),
    request: jest.fn().mockReturnValue(of(mockResponse)),
    head: jest.fn().mockReturnValue(of(mockResponse)),
    options: jest.fn().mockReturnValue(of(mockResponse)),
  } as unknown as jest.Mocked<HttpService>;
}

// ─────────────────────────────────────────────────────────────────────────────
// ConfigService Mock Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a mock ConfigService
 *
 * @example
 *   const mockConfig = createMockConfigService({
 *     DATABASE_URL: 'postgresql://localhost/test',
 *     PORT: '3000'
 *   });
 */
export function createMockConfigService(
  configMap: Record<string, string | number | boolean> = {},
): jest.Mocked<ConfigService> {
  return {
    get: jest.fn((key: string) => {
      const value = configMap[key];
      return value !== undefined ? value : null;
    }),
    getOrThrow: jest.fn((key: string) => {
      const value = configMap[key];
      if (value === undefined) {
        throw new Error(`Configuration key "${key}" is not defined`);
      }
      return value;
    }),
  } as unknown as jest.Mocked<ConfigService>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mail Service Mock Factory (Nodemailer)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a mock mail transporter
 *
 * @example
 *   const mockMail = createMockMailer();
 *   mockMail.sendMail.mockResolvedValue({ messageId: '123' });
 */
export function createMockMailer(): jest.Mocked<any> {
  return {
    sendMail: jest.fn().mockResolvedValue({
      messageId: 'mock-message-id-123',
      response: 'mock-smtp-response',
    }),
    verify: jest.fn().mockResolvedValue(true),
    close: jest.fn().mockResolvedValue(undefined),
    transport: {
      host: 'smtp.mock.com',
      port: 587,
      auth: {
        user: 'test@mock.com',
        pass: 'mock-password',
      },
    },
  } as jest.Mocked<any>;
}

// ─────────────────────────────────────────────────────────────────────────────
// EventEmitter Mock Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a mock EventEmitter2 instance
 *
 * @example
 *   const mockEmitter = createMockEventEmitter();
 *   mockEmitter.emit('event', data);
 */
export function createMockEventEmitter(): jest.Mocked<any> {
  return {
    emit: jest.fn().mockReturnValue(true),
    on: jest.fn().mockReturnThis(),
    once: jest.fn().mockReturnThis(),
    off: jest.fn().mockReturnThis(),
    removeListener: jest.fn().mockReturnThis(),
    removeAllListeners: jest.fn().mockReturnThis(),
    listeners: jest.fn().mockReturnValue([]),
    listenerCount: jest.fn().mockReturnValue(0),
    eventNames: jest.fn().mockReturnValue([]),
    rawListeners: jest.fn().mockReturnValue([]),
    setMaxListeners: jest.fn().mockReturnThis(),
    getMaxListeners: jest.fn().mockReturnValue(10),
  } as jest.Mocked<any>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Guards & Utilities Mocks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a mock ExecutionContext for testing guards
 *
 * @example
 *   const mockContext = createMockExecutionContext({
 *     user: { id: '1', email: 'test@example.com' }
 *   });
 */
export function createMockExecutionContext(request: Record<string, any> = {}): jest.Mocked<any> {
  return {
    getClass: jest.fn().mockReturnValue(Object),
    getHandler: jest.fn().mockReturnValue(() => {}),
    getArgs: jest.fn().mockReturnValue([{ user: request.user }, {}, {}]),
    getArgByIndex: jest.fn((index) => [{ user: request.user }, {}, {}][index]),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({ user: request.user, ...request }),
      getResponse: jest.fn().mockReturnValue({}),
      getNext: jest.fn().mockReturnValue({}),
    }),
    switchToWs: jest.fn().mockReturnValue({}),
    switchToRpc: jest.fn().mockReturnValue({}),
  } as jest.Mocked<any>;
}

// ─────────────────────────────────────────────────────────────────────────────
// S3 Client Mock Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a mock AWS S3 client
 *
 * @example
 *   const mockS3 = createMockS3Client();
 *   mockS3.send.mockResolvedValue({ Key: 'file.txt' });
 */
export function createMockS3Client(): jest.Mocked<any> {
  return {
    send: jest.fn(),
    listBuckets: jest.fn(),
    headBucket: jest.fn(),
    createBucket: jest.fn(),
    deleteBucket: jest.fn(),
    getObject: jest.fn(),
    putObject: jest.fn(),
    deleteObject: jest.fn(),
    listObjectsV2: jest.fn(),
    copyObject: jest.fn(),
    headObject: jest.fn(),
  } as jest.Mocked<any>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Elasticsearch Mock Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a mock Elasticsearch client
 *
 * @example
 *   const mockES = createMockElasticsearchClient();
 *   mockES.search.mockResolvedValue({ hits: { hits: [] } });
 */
export function createMockElasticsearchClient(): jest.Mocked<any> {
  return {
    search: jest.fn().mockResolvedValue({ hits: { hits: [], total: { value: 0 } } }),
    index: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
    indices: {
      create: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn(),
      putMapping: jest.fn(),
    },
    bulk: jest.fn(),
    msearch: jest.fn(),
  } as jest.Mocked<any>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Common Helper for Deep Partial Mocks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a deep partial mock object, useful for complex types
 *
 * @example
 *   const mockUser = createPartialMock<User>({
 *     id: '1',
 *     email: 'test@example.com'
 *   });
 */
export function createPartialMock<T>(overrides: Partial<T> = {}): T {
  return {
    ...overrides,
  } as T;
}
