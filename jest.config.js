module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },

  // ─── Coverage ──────────────────────────────────────────────────────────────
  // Collect from all source files (excludes test files and generated artifacts)
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.spec.ts',
    '!**/*.module.ts',
    '!**/main.ts',
    '!**/*.dto.ts',
    '!**/*.entity.ts',
    '!**/*.enum.ts',
    '!**/*.interface.ts',
    '!**/*.decorator.ts',
    '!**/*.config.ts',
    '!**/index.ts',
  ],
  coverageDirectory: '../coverage',
  // text  — printed to stdout (CI logs)
  // lcov  — consumed by GitHub Actions coverage summary step
  // html  — uploaded as an artifact for visual inspection
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],

  // ─── Coverage Thresholds ───────────────────────────────────────────────────
  // Pipeline fails if any metric falls below these values.
  // Adjust upward incrementally as the test suite matures.
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // ─── Environment ───────────────────────────────────────────────────────────
  testEnvironment: 'node',

  // ─── Performance ───────────────────────────────────────────────────────────
  // Run sequentially in CI to stay within GitHub-hosted runner memory limits.
  // Locally, remove or increase maxWorkers for faster feedback.
  maxWorkers: process.env.CI ? 1 : '50%',
  workerIdleMemoryLimit: '512MB',

  // ─── Timeouts ──────────────────────────────────────────────────────────────
  testTimeout: 15000,

  // ─── Setup ─────────────────────────────────────────────────────────────────
  setupFilesAfterEnv: ['<rootDir>/../test/setup.ts'],

  // ─── Ignore patterns ───────────────────────────────────────────────────────
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/coverage/'],

  // ─── Output & lifecycle ────────────────────────────────────────────────────
  verbose: true,
  // forceExit prevents Jest from hanging on open handles (e.g. TypeORM pools)
  forceExit: true,
  clearMocks: true,
  restoreMocks: true,
};
