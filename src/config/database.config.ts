import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { resolvePoolConfig } from '../database/pool';

interface DatabaseConnectionSettings {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

function readPrimarySettings(): DatabaseConnectionSettings {
  return {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    username: process.env.DATABASE_USER ?? 'postgres',
    password: process.env.DATABASE_PASSWORD ?? 'postgres',
    database: process.env.DATABASE_NAME ?? 'teachlink',
  };
}

function parseReplicaUrl(value: string): DatabaseConnectionSettings {
  const url = new URL(value);

  return {
    host: url.hostname,
    port: url.port ? parseInt(url.port, 10) : 5432,
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
  };
}

function parseReplicaHosts(primary: DatabaseConnectionSettings): DatabaseConnectionSettings[] {
  const hosts = (process.env.DATABASE_REPLICA_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean);

  return hosts.map((host, index) => ({
    host,
    port: parseInt(
      process.env.DATABASE_REPLICA_PORTS?.split(',')[index]?.trim() || `${primary.port}`,
      10,
    ),
    username: process.env.DATABASE_REPLICA_USER ?? primary.username,
    password: process.env.DATABASE_REPLICA_PASSWORD ?? primary.password,
    database: process.env.DATABASE_REPLICA_NAME ?? primary.database,
  }));
}

export function getReadReplicaConnections(
  primary = readPrimarySettings(),
): DatabaseConnectionSettings[] {
  const urls = (process.env.DATABASE_REPLICA_URLS ?? '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  if (urls.length > 0) {
    return urls.map(parseReplicaUrl);
  }

  return parseReplicaHosts(primary);
}

/**
 * TypeORM connection options driven by DATABASE_* environment variables.
 */
export function getDatabaseConfig(): TypeOrmModuleOptions {
  const primary = readPrimarySettings();
  const replicas = getReadReplicaConnections(primary);
  const pool = resolvePoolConfig();
  const commonOptions = {
    autoLoadEntities: true,
    synchronize: process.env.NODE_ENV !== 'production',
    extra: {
      max: pool.max,
      min: pool.min,
      connectionTimeoutMillis: pool.acquireTimeoutMs,
      idleTimeoutMillis: pool.idleTimeoutMs,
      maxLifetimeSeconds: pool.maxLifetimeSeconds,
      statement_timeout: pool.queryTimeoutMs,
    },
  };

  if (replicas.length > 0) {
    return {
      type: 'postgres',
      replication: {
        master: primary,
        slaves: replicas,
      },
      ...commonOptions,
    };
  }

  return {
    type: 'postgres',
    ...primary,
    ...commonOptions,
  };
}
