// Global test setup for observability tests

// Mock console methods to avoid noise in test output
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock process.env variables commonly used in tests
process.env.NODE_ENV = 'test';
process.env.OBSERVABILITY_SERVICE_NAME = 'test-service';
process.env.OBSERVABILITY_VERSION = '1.0.0';
process.env.OBSERVABILITY_ENABLE_TRACING = 'true';
process.env.OBSERVABILITY_ENABLE_METRICS = 'true';
process.env.OBSERVABILITY_ENABLE_LOGGING = 'true';
process.env.OBSERVABILITY_ENABLE_ANOMALY_DETECTION = 'true';

// Mock OpenTelemetry to avoid initialization issues in tests
jest.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: jest.fn(() => ({
      startSpan: jest.fn(() => ({
        setAttribute: jest.fn(),
        addEvent: jest.fn(),
        end: jest.fn(),
      })),
    })),
    setSpan: jest.fn(),
  },
  context: {
    active: jest.fn(() => ({})),
    with: jest.fn((context, fn) => fn()),
  },
  ROOT_CONTEXT: {},
  ROOT_SPAN: {},
  SpanKind: {
    CLIENT: 'client',
    SERVER: 'server',
    PRODUCER: 'producer',
    CONSUMER: 'consumer',
    INTERNAL: 'internal',
  },
  SpanStatusCode: {
    OK: 'ok',
    ERROR: 'error',
  },
}));

jest.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: jest.fn(() => ({
    start: jest.fn(),
    shutdown: jest.fn(),
  })),
}));

jest.mock('@opentelemetry/exporter-prometheus', () => ({
  PrometheusExporter: jest.fn(() => ({})),
}));

jest.mock('@opentelemetry/sdk-trace-base', () => ({
  SimpleSpanProcessor: jest.fn(() => ({})),
  BatchSpanProcessor: jest.fn(() => ({})),
}));

// Mock Prometheus client
jest.mock('prom-client', () => ({
  register: {
    metrics: jest.fn(() => 'mocked metrics'),
    clear: jest.fn(),
  },
  collectDefaultMetrics: jest.fn(),
  Counter: jest.fn(() => ({
    inc: jest.fn(),
  })),
  Gauge: jest.fn(() => ({
    set: jest.fn(),
  })),
  Histogram: jest.fn(() => ({
    observe: jest.fn(),
  })),
  Summary: jest.fn(() => ({
    observe: jest.fn(),
  })),
}));

// Global test utilities
global.testUtils = {
  createMockRepository: () => ({
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  }),

  createMockElasticsearchService: () => ({
    search: jest.fn().mockResolvedValue({
      hits: { hits: [] },
    }),
    index: jest.fn(),
    indices: {
      exists: jest.fn().mockResolvedValue(false),
      create: jest.fn(),
    },
  }),

  createMockQueue: () => ({
    add: jest.fn(),
    process: jest.fn(),
  }),
};
