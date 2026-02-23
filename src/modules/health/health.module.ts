import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/**
 * #157 – HealthModule
 *
 * Import into AppModule to expose /health, /health/live, /health/ready.
 *
 * Prerequisites (already expected in AppModule):
 *  - TypeOrmModule  – provides the default DataSource via @InjectDataSource()
 *  - RedisModule    – provides the Redis client via @InjectRedis()
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}