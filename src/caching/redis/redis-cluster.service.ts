import {
  Injectable,
  Logger,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import { Cluster } from 'ioredis';

@Injectable()
export class RedisClusterService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisClusterService.name);
  private cluster: Cluster;
  private isConnected = false;

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect() {
    try {
      const nodes = (
        process.env.REDIS_CLUSTER_NODES ||
        'localhost:7000,localhost:7001,localhost:7002'
      )
        .split(',')
        .map((node) => {
          const [host, port] = node.split(':');
          return { host, port: Number.parseInt(port) };
        });

      this.cluster = new Cluster(nodes, {
        redisOptions: {
          password: process.env.REDIS_PASSWORD,
          connectTimeout: 10000,
          lazyConnect: true,
          maxRetriesPerRequest: 3,
        },
        enableOfflineQueue: false,
        retryDelayOnFailover: 100,
        // maxRetriesPerRequest: 3,
        scaleReads: 'slave',
      });

      this.cluster.on('connect', () => {
        this.isConnected = true;
        this.logger.log('Redis cluster connected');
      });

      this.cluster.on('error', (error) => {
        this.logger.error('Redis cluster error', error);
        this.isConnected = false;
      });

      this.cluster.on('node error', (error, node) => {
        this.logger.error(
          `Redis node error: ${node.options.host}:${node.options.port}`,
          error,
        );
      });

      await this.cluster.connect();
    } catch (error) {
      this.logger.error('Failed to connect to Redis cluster', error);
      throw error;
    }
  }

  private async disconnect() {
    if (this.cluster) {
      await this.cluster.disconnect();
      this.isConnected = false;
      this.logger.log('Redis cluster disconnected');
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.isConnected) {
      throw new Error('Redis cluster not connected');
    }
    return await this.cluster.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Redis cluster not connected');
    }

    if (ttlSeconds) {
      await this.cluster.setex(key, ttlSeconds, value);
    } else {
      await this.cluster.set(key, value);
    }
  }

  async del(key: string): Promise<number> {
    if (!this.isConnected) {
      throw new Error('Redis cluster not connected');
    }
    return await this.cluster.del(key);
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    if (!this.isConnected) {
      throw new Error('Redis cluster not connected');
    }
    return await this.cluster.mget(...keys);
  }

  async mset(keyValues: Record<string, string>): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Redis cluster not connected');
    }

    const args = Object.entries(keyValues).flat();
    await this.cluster.mset(...args);
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isConnected) {
      throw new Error('Redis cluster not connected');
    }
    const result = await this.cluster.exists(key);
    return result === 1;
  }

  async ttl(key: string): Promise<number> {
    if (!this.isConnected) {
      throw new Error('Redis cluster not connected');
    }
    return await this.cluster.ttl(key);
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.isConnected) {
      throw new Error('Redis cluster not connected');
    }
    const result = await this.cluster.expire(key, seconds);
    return result === 1;
  }

  async scan(pattern: string, count = 100): Promise<string[]> {
    if (!this.isConnected) {
      throw new Error('Redis cluster not connected');
    }

    const keys: string[] = [];
    const nodes = this.cluster.nodes('master');

    for (const node of nodes) {
      let cursor = '0';
      do {
        const result = await node.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          count,
        );
        cursor = result[0];
        keys.push(...result[1]);
      } while (cursor !== '0');
    }

    return [...new Set(keys)];
  }

  async flushall(): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Redis cluster not connected');
    }
    await this.cluster.flushall();
  }

  async info(): Promise<string> {
    if (!this.isConnected) {
      throw new Error('Redis cluster not connected');
    }
    return await this.cluster.info();
  }

  async getClusterInfo(): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Redis cluster not connected');
    }

    const nodes = this.cluster.nodes();
    const nodeInfo = await Promise.all(
      nodes.map(async (node) => {
        try {
          const info = await node.info();
          return {
            host: node.options.host,
            port: node.options.port,
            status: node.status,
            info: this.parseRedisInfo(info),
          };
        } catch (error) {
          return {
            host: node.options.host,
            port: node.options.port,
            status: 'error',
            error: error.message,
          };
        }
      }),
    );

    return {
      totalNodes: nodes.length,
      connectedNodes: nodeInfo.filter((n) => n.status === 'ready').length,
      nodes: nodeInfo,
    };
  }

  private parseRedisInfo(info: string): any {
    const parsed = {};
    const lines = info.split('\r\n');

    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        parsed[key] = isNaN(Number(value)) ? value : Number(value);
      }
    }

    return parsed;
  }

  getCluster(): Cluster {
    return this.cluster;
  }

  isClusterConnected(): boolean {
    return this.isConnected;
  }
}
