module.exports = {
  displayName: 'Observability Tests',
  testMatch: ['**/*.spec.ts'],
  collectCoverageFrom: [
    '**/*.service.ts',
    '!**/*.spec.ts',
    '!**/node_modules/**',
  ],
  coverageDirectory: 'coverage/observability',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/test-setup.ts'],
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testTimeout: 30000,
};
