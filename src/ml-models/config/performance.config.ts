export interface PerformanceConfig {
  caching: CacheConfig;
  database: DatabaseConfig;
  async: AsyncConfig;
  monitoring: MonitoringConfig;
  deployment: DeploymentConfig;
  training: TrainingConfig;
}

export interface CacheConfig {
  enabled: boolean;
  ttl: number; // Time to live in seconds
  maxSize: number; // Maximum number of items in cache
  prefix: string;
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
    keyPrefix: string;
  };
  strategies: {
    modelList: CacheStrategy;
    modelDetails: CacheStrategy;
    performanceMetrics: CacheStrategy;
    driftResults: CacheStrategy;
    statistics: CacheStrategy;
  };
}

export interface CacheStrategy {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  invalidationPatterns: string[];
}

export interface DatabaseConfig {
  connectionPool: {
    min: number;
    max: number;
    acquireTimeout: number;
    idleTimeout: number;
  };
  queryOptimization: {
    enableQueryCache: boolean;
    queryCacheSize: number;
    slowQueryThreshold: number; // milliseconds
    enableQueryLogging: boolean;
  };
  indexing: {
    autoCreate: boolean;
    indexes: DatabaseIndex[];
  };
  batchOperations: {
    enabled: boolean;
    batchSize: number;
    batchTimeout: number;
  };
}

export interface DatabaseIndex {
  table: string;
  columns: string[];
  type: 'btree' | 'hash' | 'gin' | 'gist';
  unique?: boolean;
  partial?: string;
}

export interface AsyncConfig {
  queue: {
    enabled: boolean;
    name: string;
    concurrency: number;
    retryAttempts: number;
    retryDelay: number;
  };
  workers: {
    training: WorkerConfig;
    deployment: WorkerConfig;
    monitoring: WorkerConfig;
    driftDetection: WorkerConfig;
  };
  eventProcessing: {
    enabled: boolean;
    batchSize: number;
    batchTimeout: number;
    maxConcurrency: number;
  };
}

export interface WorkerConfig {
  enabled: boolean;
  concurrency: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  memoryLimit: string;
  cpuLimit: string;
}

export interface MonitoringConfig {
  metrics: {
    enabled: boolean;
    collectionInterval: number;
    retentionPeriod: number;
    aggregationRules: MetricAggregationRule[];
  };
  alerts: {
    enabled: boolean;
    checkInterval: number;
    notificationChannels: string[];
    thresholds: AlertThresholds;
  };
  driftDetection: {
    enabled: boolean;
    checkInterval: number;
    sampleSize: number;
    confidenceLevel: number;
    methods: DriftDetectionMethod[];
  };
}

export interface MetricAggregationRule {
  metric: string;
  aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count';
  interval: number;
  retention: number;
}

export interface AlertThresholds {
  cpuUsage: number;
  memoryUsage: number;
  errorRate: number;
  latency: number;
  driftScore: number;
  performanceDecay: number;
}

export interface DriftDetectionMethod {
  name: string;
  enabled: boolean;
  weight: number;
  threshold: number;
}

export interface DeploymentConfig {
  scaling: {
    enabled: boolean;
    minReplicas: number;
    maxReplicas: number;
    targetCPUUtilization: number;
    targetMemoryUtilization: number;
    scaleUpCooldown: number;
    scaleDownCooldown: number;
  };
  healthChecks: {
    enabled: boolean;
    interval: number;
    timeout: number;
    retries: number;
    successThreshold: number;
    failureThreshold: number;
  };
  loadBalancing: {
    enabled: boolean;
    algorithm: 'round_robin' | 'least_connections' | 'weighted';
    sessionAffinity: boolean;
    healthCheckPath: string;
  };
}

export interface TrainingConfig {
  hyperparameterOptimization: {
    enabled: boolean;
    maxTrials: number;
    timeout: number;
    parallelTrials: number;
    searchAlgorithm: 'random' | 'bayesian' | 'grid' | 'genetic';
  };
  crossValidation: {
    enabled: boolean;
    folds: number;
    shuffle: boolean;
    randomState: number;
  };
  earlyStopping: {
    enabled: boolean;
    patience: number;
    minDelta: number;
    monitor: string;
  };
  resourceAllocation: {
    cpuLimit: string;
    memoryLimit: string;
    gpuEnabled: boolean;
    gpuCount: number;
  };
}

// Default configuration
export const defaultPerformanceConfig: PerformanceConfig = {
  caching: {
    enabled: true,
    ttl: 300, // 5 minutes
    maxSize: 1000,
    prefix: 'ml_model',
    redis: {
      host: 'localhost',
      port: 6379,
      db: 0,
      keyPrefix: 'ml_model:',
    },
    strategies: {
      modelList: {
        enabled: true,
        ttl: 300,
        maxSize: 100,
        invalidationPatterns: [
          'model:created',
          'model:updated',
          'model:deleted',
        ],
      },
      modelDetails: {
        enabled: true,
        ttl: 600,
        maxSize: 500,
        invalidationPatterns: ['model:updated', 'model:deleted'],
      },
      performanceMetrics: {
        enabled: true,
        ttl: 1800, // 30 minutes
        maxSize: 200,
        invalidationPatterns: ['metrics:recorded'],
      },
      driftResults: {
        enabled: true,
        ttl: 3600, // 1 hour
        maxSize: 100,
        invalidationPatterns: ['drift:detected'],
      },
      statistics: {
        enabled: true,
        ttl: 900, // 15 minutes
        maxSize: 50,
        invalidationPatterns: [
          'model:created',
          'model:deleted',
          'deployment:created',
          'deployment:deleted',
        ],
      },
    },
  },
  database: {
    connectionPool: {
      min: 5,
      max: 20,
      acquireTimeout: 60000,
      idleTimeout: 300000,
    },
    queryOptimization: {
      enableQueryCache: true,
      queryCacheSize: 1000,
      slowQueryThreshold: 1000,
      enableQueryLogging: false,
    },
    indexing: {
      autoCreate: true,
      indexes: [
        {
          table: 'ml_models',
          columns: ['status', 'type', 'framework'],
          type: 'btree',
        },
        {
          table: 'ml_models',
          columns: ['created_at'],
          type: 'btree',
        },
        {
          table: 'ml_models',
          columns: ['name'],
          type: 'btree',
          unique: true,
        },
        {
          table: 'model_versions',
          columns: ['model_id', 'status'],
          type: 'btree',
        },
        {
          table: 'model_versions',
          columns: ['created_at'],
          type: 'btree',
        },
        {
          table: 'model_deployments',
          columns: ['model_id', 'status'],
          type: 'btree',
        },
        {
          table: 'model_deployments',
          columns: ['environment', 'status'],
          type: 'btree',
        },
        {
          table: 'model_performance',
          columns: ['model_id', 'metric_type', 'recorded_at'],
          type: 'btree',
        },
        {
          table: 'ab_tests',
          columns: ['status', 'model_a_id', 'model_b_id'],
          type: 'btree',
        },
        {
          table: 'ab_tests',
          columns: ['created_at'],
          type: 'btree',
        },
      ],
    },
    batchOperations: {
      enabled: true,
      batchSize: 100,
      batchTimeout: 5000,
    },
  },
  async: {
    queue: {
      enabled: true,
      name: 'ml-models-queue',
      concurrency: 5,
      retryAttempts: 3,
      retryDelay: 5000,
    },
    workers: {
      training: {
        enabled: true,
        concurrency: 2,
        timeout: 3600000, // 1 hour
        retryAttempts: 2,
        retryDelay: 30000,
        memoryLimit: '4Gi',
        cpuLimit: '2',
      },
      deployment: {
        enabled: true,
        concurrency: 3,
        timeout: 300000, // 5 minutes
        retryAttempts: 3,
        retryDelay: 10000,
        memoryLimit: '2Gi',
        cpuLimit: '1',
      },
      monitoring: {
        enabled: true,
        concurrency: 5,
        timeout: 60000, // 1 minute
        retryAttempts: 2,
        retryDelay: 5000,
        memoryLimit: '1Gi',
        cpuLimit: '0.5',
      },
      driftDetection: {
        enabled: true,
        concurrency: 2,
        timeout: 300000, // 5 minutes
        retryAttempts: 2,
        retryDelay: 15000,
        memoryLimit: '2Gi',
        cpuLimit: '1',
      },
    },
    eventProcessing: {
      enabled: true,
      batchSize: 50,
      batchTimeout: 1000,
      maxConcurrency: 10,
    },
  },
  monitoring: {
    metrics: {
      enabled: true,
      collectionInterval: 30000, // 30 seconds
      retentionPeriod: 2592000000, // 30 days
      aggregationRules: [
        {
          metric: 'prediction_latency',
          aggregation: 'avg',
          interval: 60000, // 1 minute
          retention: 86400000, // 1 day
        },
        {
          metric: 'prediction_accuracy',
          aggregation: 'avg',
          interval: 300000, // 5 minutes
          retention: 604800000, // 7 days
        },
        {
          metric: 'model_drift_score',
          aggregation: 'max',
          interval: 3600000, // 1 hour
          retention: 2592000000, // 30 days
        },
      ],
    },
    alerts: {
      enabled: true,
      checkInterval: 60000, // 1 minute
      notificationChannels: ['email', 'slack', 'webhook'],
      thresholds: {
        cpuUsage: 80,
        memoryUsage: 85,
        errorRate: 5,
        latency: 1000,
        driftScore: 0.2,
        performanceDecay: 0.1,
      },
    },
    driftDetection: {
      enabled: true,
      checkInterval: 3600000, // 1 hour
      sampleSize: 1000,
      confidenceLevel: 0.95,
      methods: [
        {
          name: 'statistical_test',
          enabled: true,
          weight: 0.3,
          threshold: 0.1,
        },
        {
          name: 'distribution_comparison',
          enabled: true,
          weight: 0.25,
          threshold: 0.15,
        },
        {
          name: 'performance_monitoring',
          enabled: true,
          weight: 0.3,
          threshold: 0.1,
        },
        {
          name: 'quality_metrics',
          enabled: true,
          weight: 0.15,
          threshold: 0.2,
        },
      ],
    },
  },
  deployment: {
    scaling: {
      enabled: true,
      minReplicas: 1,
      maxReplicas: 10,
      targetCPUUtilization: 70,
      targetMemoryUtilization: 80,
      scaleUpCooldown: 300,
      scaleDownCooldown: 300,
    },
    healthChecks: {
      enabled: true,
      interval: 30,
      timeout: 10,
      retries: 3,
      successThreshold: 1,
      failureThreshold: 3,
    },
    loadBalancing: {
      enabled: true,
      algorithm: 'round_robin',
      sessionAffinity: false,
      healthCheckPath: '/health',
    },
  },
  training: {
    hyperparameterOptimization: {
      enabled: true,
      maxTrials: 20,
      timeout: 3600000, // 1 hour
      parallelTrials: 3,
      searchAlgorithm: 'bayesian',
    },
    crossValidation: {
      enabled: true,
      folds: 5,
      shuffle: true,
      randomState: 42,
    },
    earlyStopping: {
      enabled: true,
      patience: 10,
      minDelta: 0.001,
      monitor: 'val_loss',
    },
    resourceAllocation: {
      cpuLimit: '4',
      memoryLimit: '8Gi',
      gpuEnabled: false,
      gpuCount: 0,
    },
  },
};

// Environment-specific configurations
export const getPerformanceConfig = (): PerformanceConfig => {
  const env = process.env.NODE_ENV || 'development';

  switch (env) {
    case 'production':
      return {
        ...defaultPerformanceConfig,
        caching: {
          ...defaultPerformanceConfig.caching,
          ttl: 600, // 10 minutes in production
          maxSize: 5000,
          redis: {
            ...defaultPerformanceConfig.caching.redis,
            host: process.env.REDIS_HOST || 'redis',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            db: parseInt(process.env.REDIS_DB || '0'),
          },
        },
        database: {
          ...defaultPerformanceConfig.database,
          connectionPool: {
            min: 10,
            max: 50,
            acquireTimeout: 60000,
            idleTimeout: 300000,
          },
        },
        async: {
          ...defaultPerformanceConfig.async,
          workers: {
            training: {
              ...defaultPerformanceConfig.async.workers.training,
              concurrency: 5,
              memoryLimit: '8Gi',
              cpuLimit: '4',
            },
            deployment: {
              ...defaultPerformanceConfig.async.workers.deployment,
              concurrency: 5,
              memoryLimit: '4Gi',
              cpuLimit: '2',
            },
            monitoring: {
              ...defaultPerformanceConfig.async.workers.monitoring,
              concurrency: 10,
            },
            driftDetection: {
              ...defaultPerformanceConfig.async.workers.driftDetection,
              concurrency: 4,
            },
          },
        },
        training: {
          ...defaultPerformanceConfig.training,
          hyperparameterOptimization: {
            ...defaultPerformanceConfig.training.hyperparameterOptimization,
            maxTrials: 50,
            parallelTrials: 5,
          },
          resourceAllocation: {
            ...defaultPerformanceConfig.training.resourceAllocation,
            cpuLimit: '8',
            memoryLimit: '16Gi',
            gpuEnabled: true,
            gpuCount: 1,
          },
        },
      };

    case 'test':
      return {
        ...defaultPerformanceConfig,
        caching: {
          ...defaultPerformanceConfig.caching,
          enabled: false, // Disable caching in tests
        },
        monitoring: {
          ...defaultPerformanceConfig.monitoring,
          metrics: {
            ...defaultPerformanceConfig.monitoring.metrics,
            enabled: false,
          },
          alerts: {
            ...defaultPerformanceConfig.monitoring.alerts,
            enabled: false,
          },
        },
        async: {
          ...defaultPerformanceConfig.async,
          queue: {
            ...defaultPerformanceConfig.async.queue,
            enabled: false,
          },
        },
      };

    default: // development
      return defaultPerformanceConfig;
  }
};

// Utility functions for performance optimization
export const createCacheKey = (prefix: string, ...parts: string[]): string => {
  return `${prefix}:${parts.join(':')}`;
};

export const createCachePattern = (prefix: string, pattern: string): string => {
  return `${prefix}:${pattern}`;
};

export const shouldUseCache = (
  config: PerformanceConfig,
  strategy: keyof typeof config.caching.strategies,
): boolean => {
  return config.caching.enabled && config.caching.strategies[strategy].enabled;
};

export const getCacheTTL = (
  config: PerformanceConfig,
  strategy: keyof typeof config.caching.strategies,
): number => {
  return config.caching.strategies[strategy].ttl;
};

export const isSlowQuery = (
  duration: number,
  config: PerformanceConfig,
): boolean => {
  return duration > config.database.queryOptimization.slowQueryThreshold;
};

export const shouldBatchOperation = (
  config: PerformanceConfig,
  operationCount: number,
): boolean => {
  return (
    config.database.batchOperations.enabled &&
    operationCount >= config.database.batchOperations.batchSize
  );
};

export const getWorkerConfig = (
  config: PerformanceConfig,
  workerType: keyof typeof config.async.workers,
): WorkerConfig => {
  return config.async.workers[workerType];
};

export const isDriftDetectionEnabled = (config: PerformanceConfig): boolean => {
  return config.monitoring.driftDetection.enabled;
};

export const getDriftDetectionInterval = (
  config: PerformanceConfig,
): number => {
  return config.monitoring.driftDetection.checkInterval;
};
