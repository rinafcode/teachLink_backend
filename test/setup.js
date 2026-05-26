"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
process.env.NODE_OPTIONS = '--max-old-space-size=2048';
process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_placeholder';
process.env.DATABASE_HOST = 'localhost';
process.env.DATABASE_PORT = '5432';
process.env.DATABASE_USER = 'postgres';
process.env.DATABASE_PASSWORD = 'password';
process.env.DATABASE_NAME = 'test_db';
process.env.ENCRYPTION_SECRET = 'super-secret-key-32-chars-long-x';
global.console = {
    ...console,
};
jest.setTimeout(10000);
globalThis.testUtils = {
    createMinimalMock: (properties) => ({
        ...properties,
        id: properties.id || 'test-id',
        createdAt: properties.createdAt || new Date(),
        updatedAt: properties.updatedAt || new Date(),
    }),
    createRepositoryMock: () => ({
        create: jest.fn(),
        save: jest.fn(),
        findOne: jest.fn(),
        find: jest.fn(),
        count: jest.fn(),
        remove: jest.fn(),
        createQueryBuilder: jest.fn(() => ({
            leftJoinAndSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            getCount: jest.fn().mockResolvedValue(1),
            getMany: jest.fn().mockResolvedValue([]),
        })),
    }),
    createServiceMock: () => ({}),
};
afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
});
afterAll(() => {
});
//# sourceMappingURL=setup.js.map