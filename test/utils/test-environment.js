const NodeEnvironment = require('jest-environment-node');

class TestEnvironment extends NodeEnvironment {
  constructor(config, context) {
    super(config, context);

    // Set test-specific environment variables
    this.global.process.env.NODE_ENV = 'test';
    this.global.process.env.JEST_WORKER_ID = context.testPath || 'unknown';

    // Increase memory limit for E2E tests
    this.global.process.env.NODE_OPTIONS = '--max-old-space-size=1024';

    // Set database to test database
    this.global.process.env.DATABASE_NAME = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Disable external API calls in tests
    this.global.process.env.DISABLE_EXTERNAL_APIS = 'true';

    // Set shorter timeouts for faster test feedback
    this.global.process.env.REQUEST_TIMEOUT = '5000';
    this.global.process.env.DATABASE_TIMEOUT = '3000';

    // Mock external services
    this.global.process.env.REDIS_URL = 'redis://localhost:6379';
    this.global.process.env.QUEUE_REDIS_URL = 'redis://localhost:6379';

    // Email service mock
    this.global.process.env.SMTP_HOST = 'localhost';
    this.global.process.env.SMTP_PORT = '1025';

    // File storage mock
    this.global.process.env.STORAGE_TYPE = 'local';
    this.global.process.env.STORAGE_PATH = './test-storage';
  }

  async setup() {
    await super.setup();

    // Ensure clean test environment
    this.global.beforeAll && await this.ensureCleanSetup();
  }

  async teardown() {
    // Clean up any test-specific resources
    await this.cleanupTestResources();

    await super.teardown();
  }

  async ensureCleanSetup() {
    // Wait for any pending async operations to complete
    await this.waitForPendingOperations();

    // Ensure database connections are ready
    await this.ensureDatabaseReady();

    // Clean up any leftover test data
    await this.cleanupLeftoverData();
  }

  async cleanupTestResources() {
    // Close any open connections
    await this.closeOpenConnections();

    // Clean up test files/directories
    await this.cleanupTestFiles();

    // Reset global state
    await this.resetGlobalState();
  }

  async waitForPendingOperations() {
    // Wait for any background operations to complete
    const pendingOps = this.global.pendingOperations || [];
    await Promise.all(pendingOps);

    // Small delay to ensure system stability
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  async ensureDatabaseReady() {
    // Implement database readiness check
    try {
      // This would typically ping the database
      // For now, just ensure the connection string is set
      if (!this.global.process.env.DATABASE_NAME) {
        throw new Error('Database not configured for test environment');
      }
    } catch (error) {
      console.warn('Database readiness check failed:', error.message);
      // Don't fail the test setup, just warn
    }
  }

  async cleanupLeftoverData() {
    // Clean up any test data that might have been left from previous runs
    try {
      // This would typically truncate test tables or clean collections
      // Implementation depends on the specific database setup
    } catch (error) {
      console.warn('Leftover data cleanup failed:', error.message);
    }
  }

  async closeOpenConnections() {
    // Close any open database connections, Redis connections, etc.
    try {
      // Implementation depends on how connections are managed
      // This might involve calling cleanup methods on connection pools
    } catch (error) {
      console.warn('Connection cleanup failed:', error.message);
    }
  }

  async cleanupTestFiles() {
    // Clean up any test files or directories created during tests
    const fs = require('fs').promises;
    const path = require('path');

    const testStoragePath = path.join(process.cwd(), 'test-storage');

    try {
      // Remove test storage directory if it exists
      await fs.rm(testStoragePath, { recursive: true, force: true });
    } catch (error) {
      // Ignore if directory doesn't exist
    }
  }

  async resetGlobalState() {
    // Reset any global state that might affect subsequent tests
    if (this.global.testState) {
      this.global.testState = {};
    }

    // Clear any cached data
    if (this.global.testCache) {
      this.global.testCache.clear();
    }
  }

  // Utility method for tests to wait for conditions
  async waitForCondition(
    condition: () => boolean | Promise<boolean>,
    options: {
      timeout?: number;
      interval?: number;
      description?: string;
    } = {},
  ): Promise<void> {
    const { timeout = 5000, interval = 100, description = 'condition' } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const result = await condition();
        if (result) {
          return;
        }
      } catch (error) {
        // Continue waiting
      }

      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error(`${description} did not become true within ${timeout}ms`);
  }

  // Utility method for stable async operations
  async withRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxAttempts?: number;
      delayMs?: number;
      backoffMultiplier?: number;
      retryCondition?: (error: any) => boolean;
    } = {},
  ): Promise<T> {
    const {
      maxAttempts = 3,
      delayMs = 1000,
      backoffMultiplier = 1.5,
      retryCondition = (error) => error.code === 'ECONNREFUSED' || error.status >= 500,
    } = options;

    let lastError: any;
    let currentDelay = delayMs;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === maxAttempts || !retryCondition(error)) {
          throw error;
        }

        console.warn(`Operation failed on attempt ${attempt}, retrying in ${currentDelay}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, currentDelay));
        currentDelay = Math.floor(currentDelay * backoffMultiplier);
      }
    }

    throw lastError;
  }
}

module.exports = TestEnvironment;