import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthIndicatorsService {
  async checkPostgres(): Promise<boolean> { return true; }
  async checkRedis(): Promise<boolean> { return true; }
  async checkElasticsearch(): Promise<boolean> { return true; }
  async checkQueueDepth(): Promise<boolean> { return true; }

  async readiness(): Promise<Record<string, string>> {
    const results = {
      postgres: await this.checkPostgres() ? 'up' : 'down',
      redis: await this.checkRedis() ? 'up' : 'down',
      elasticsearch: await this.checkElasticsearch() ? 'up' : 'down',
      queue: await this.checkQueueDepth() ? 'up' : 'down',
    };
    return results;
  }
}
