import { SetMetadata } from '@nestjs/common';

export interface MonitorOptions {
  operation: string;
  tags?: Record<string, string>;
  recordMetrics?: boolean;
  recordTraces?: boolean;
  recordLogs?: boolean;
}

export interface DatabaseMonitorOptions {
  operation: string;
  table?: string;
  recordQueryTime?: boolean;
  recordRowCount?: boolean;
}

export const MONITOR_OPERATION_KEY = 'monitor_operation';
export const MONITOR_DATABASE_KEY = 'monitor_database';

export const MonitorOperation = (
  operation: string,
  options: Partial<MonitorOptions> = {},
) => {
  return SetMetadata(MONITOR_OPERATION_KEY, {
    operation,
    tags: options.tags || {},
    recordMetrics: options.recordMetrics !== false,
    recordTraces: options.recordTraces !== false,
    recordLogs: options.recordLogs !== false,
  });
};

export const MonitorDatabase = (
  operation: string,
  options: Partial<DatabaseMonitorOptions> = {},
) => {
  return SetMetadata(MONITOR_DATABASE_KEY, {
    operation,
    table: options.table,
    recordQueryTime: options.recordQueryTime !== false,
    recordRowCount: options.recordRowCount !== false,
  });
};

export const MonitorCache = (operationName: string) => {
  return MonitorOperation(`cache_${operationName}`, {
    tags: { type: 'cache' },
    recordMetrics: true,
    recordTraces: true,
    recordLogs: true,
  });
};

export const MonitorExternalService = (
  serviceName: string,
  operationName: string,
) => {
  return MonitorOperation(`external_${serviceName}_${operationName}`, {
    tags: { type: 'external', service: serviceName },
    recordMetrics: true,
    recordTraces: true,
    recordLogs: true,
  });
};
