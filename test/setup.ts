// Test setup file to optimize memory usage and test performance

// Increase Node.js memory limit for tests
process.env.NODE_OPTIONS = '--max-old-space-size=2048';

// Mock console methods to reduce output noise
global.console = {
  ...console,
  // Uncomment to suppress console output during tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Set test timeout
jest.setTimeout(10000);

// Global test utilities
global.testUtils = {
  // Helper to create minimal mock objects
  createMinimalMock: (properties: Record<string, any>) => ({
    ...properties,
    id: properties.id || 'test-id',
    createdAt: properties.createdAt || new Date(),
    updatedAt: properties.updatedAt || new Date(),
  }),

  // Helper to create repository mock
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

  // Helper to create service mock
  createServiceMock: () => ({
    // Add common service methods here
  }),
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});

// Global teardown
afterAll(() => {
  // Clean up any remaining resources
}); 