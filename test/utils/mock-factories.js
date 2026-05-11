"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMockRepository = createMockRepository;
exports.createMockQueryBuilder = createMockQueryBuilder;
exports.createMockCachingService = createMockCachingService;
exports.createMockRedisClient = createMockRedisClient;
exports.createMockBullQueue = createMockBullQueue;
exports.createMockHttpClient = createMockHttpClient;
exports.createMockConfigService = createMockConfigService;
exports.createMockMailer = createMockMailer;
exports.createMockEventEmitter = createMockEventEmitter;
exports.createMockExecutionContext = createMockExecutionContext;
exports.createMockS3Client = createMockS3Client;
exports.createMockElasticsearchClient = createMockElasticsearchClient;
exports.createPartialMock = createPartialMock;
const rxjs_1 = require("rxjs");
function createMockRepository() {
    return {
        find: jest.fn(),
        findOne: jest.fn(),
        findOneBy: jest.fn(),
        findOneOrFail: jest.fn(),
        findAndCount: jest.fn().mockResolvedValue([[], 0]),
        count: jest.fn().mockResolvedValue(0),
        exist: jest.fn().mockResolvedValue(false),
        create: jest.fn((data) => data),
        save: jest.fn().mockImplementation(async (data) => data),
        insert: jest.fn().mockResolvedValue({ generatedMaps: [], raw: [], affected: 1 }),
        update: jest
            .fn()
            .mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] }),
        delete: jest
            .fn()
            .mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] }),
        remove: jest.fn(),
        clear: jest.fn(),
        createQueryBuilder: jest.fn(() => createMockQueryBuilder()),
        transaction: jest.fn(),
        query: jest.fn(),
        increment: jest.fn(),
        decrement: jest.fn(),
        target: Object,
        manager: {},
        metadata: {},
    };
}
function createMockQueryBuilder() {
    return {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orWhere: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        having: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
        getMany: jest.fn().mockResolvedValue([]),
        getCount: jest.fn().mockResolvedValue(0),
        getRawOne: jest.fn().mockResolvedValue(null),
        getRawMany: jest.fn().mockResolvedValue([]),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
        alias: 'entity',
        expressionMap: {},
        connection: {},
    };
}
function createMockCachingService() {
    return {
        get: jest.fn(),
        set: jest.fn().mockResolvedValue(undefined),
        getOrSet: jest.fn().mockImplementation(async (_key, handler) => handler()),
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
    };
}
function createMockRedisClient() {
    const pipelineResult = {
        get: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        del: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
    };
    return {
        get: jest.fn(),
        set: jest.fn(),
        getex: jest.fn(),
        getdel: jest.fn(),
        append: jest.fn(),
        strlen: jest.fn(),
        hget: jest.fn(),
        hset: jest.fn(),
        hdel: jest.fn(),
        hgetall: jest.fn(),
        hkeys: jest.fn(),
        hvals: jest.fn(),
        hexists: jest.fn(),
        hlen: jest.fn(),
        lpush: jest.fn(),
        rpush: jest.fn(),
        lpop: jest.fn(),
        rpop: jest.fn(),
        llen: jest.fn(),
        lrange: jest.fn(),
        sadd: jest.fn(),
        srem: jest.fn(),
        smembers: jest.fn(),
        scard: jest.fn(),
        sismember: jest.fn(),
        zadd: jest.fn(),
        zrem: jest.fn(),
        zrange: jest.fn(),
        zcard: jest.fn(),
        zscore: jest.fn(),
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
        eval: jest.fn(),
        evalsha: jest.fn(),
        script: jest.fn(),
        multi: jest.fn().mockReturnThis(),
        exec: jest.fn(),
        discard: jest.fn(),
        watch: jest.fn(),
        unwatch: jest.fn(),
        ping: jest.fn().mockResolvedValue('PONG'),
        echo: jest.fn(),
        info: jest.fn(),
        dbsize: jest.fn(),
        flushdb: jest.fn(),
        flushall: jest.fn(),
        select: jest.fn(),
        auth: jest.fn(),
        mget: jest.fn(),
        mset: jest.fn(),
        pipeline: jest.fn().mockReturnValue(pipelineResult),
        incr: jest.fn(),
        incrby: jest.fn(),
        incrbyfloat: jest.fn(),
        decr: jest.fn(),
        decrby: jest.fn(),
        connect: jest.fn(),
        quit: jest.fn().mockResolvedValue('OK'),
        disconnect: jest.fn(),
        status: 'ready',
    };
}
function createMockBullQueue() {
    return {
        add: jest.fn(),
        process: jest.fn(),
        on: jest.fn(),
        once: jest.fn(),
        off: jest.fn(),
        removeAllListeners: jest.fn(),
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
        empty: jest.fn().mockResolvedValue(undefined),
        clean: jest.fn().mockResolvedValue([]),
        pause: jest.fn().mockResolvedValue(undefined),
        resume: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        remove: jest.fn(),
        drain: jest.fn().mockResolvedValue(undefined),
        removeRepeatableByKey: jest.fn(),
        getRepeatableCount: jest.fn().mockResolvedValue(0),
        name: 'mock-queue',
        client: {},
        jobsOpts: {},
    };
}
function createMockHttpClient() {
    const mockResponse = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
    };
    return {
        get: jest.fn().mockReturnValue((0, rxjs_1.of)(mockResponse)),
        post: jest.fn().mockReturnValue((0, rxjs_1.of)(mockResponse)),
        put: jest.fn().mockReturnValue((0, rxjs_1.of)(mockResponse)),
        patch: jest.fn().mockReturnValue((0, rxjs_1.of)(mockResponse)),
        delete: jest.fn().mockReturnValue((0, rxjs_1.of)(mockResponse)),
        request: jest.fn().mockReturnValue((0, rxjs_1.of)(mockResponse)),
        head: jest.fn().mockReturnValue((0, rxjs_1.of)(mockResponse)),
        options: jest.fn().mockReturnValue((0, rxjs_1.of)(mockResponse)),
    };
}
function createMockConfigService(configMap = {}) {
    return {
        get: jest.fn((key) => {
            const value = configMap[key];
            return value !== undefined ? value : null;
        }),
        getOrThrow: jest.fn((key) => {
            const value = configMap[key];
            if (value === undefined) {
                throw new Error(`Configuration key "${key}" is not defined`);
            }
            return value;
        }),
    };
}
function createMockMailer() {
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
    };
}
function createMockEventEmitter() {
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
    };
}
function createMockExecutionContext(request = {}) {
    return {
        getClass: jest.fn().mockReturnValue(Object),
        getHandler: jest.fn().mockReturnValue(() => { }),
        getArgs: jest.fn().mockReturnValue([{ user: request.user }, {}, {}]),
        getArgByIndex: jest.fn((index) => [{ user: request.user }, {}, {}][index]),
        switchToHttp: jest.fn().mockReturnValue({
            getRequest: jest.fn().mockReturnValue({ user: request.user, ...request }),
            getResponse: jest.fn().mockReturnValue({}),
            getNext: jest.fn().mockReturnValue({}),
        }),
        switchToWs: jest.fn().mockReturnValue({}),
        switchToRpc: jest.fn().mockReturnValue({}),
    };
}
function createMockS3Client() {
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
    };
}
function createMockElasticsearchClient() {
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
    };
}
function createPartialMock(overrides = {}) {
    return {
        ...overrides,
    };
}
//# sourceMappingURL=mock-factories.js.map