export const databaseTimeoutConfig = {
  statementTimeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS) || 30000,
  slowQueryThreshold: Number(process.env.DB_SLOW_QUERY_THRESHOLD_MS) || 1000,
};
