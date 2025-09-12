import { registerAs } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Video } from '../entities/video.entity';
import { VideoVariant } from '../entities/video-variant.entity';
import { VideoProcessingJob } from '../entities/video-processing-job.entity';
import { ProcessingQueue } from '../entities/processing-queue.entity';

export default registerAs(
  'database',
  (): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number.parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'video_processing',
    entities: [Video, VideoVariant, VideoProcessingJob, ProcessingQueue],
    synchronize: process.env.NODE_ENV === 'development',
    logging: process.env.DB_LOGGING === 'true',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    migrations: ['dist/migrations/*.js'],
    migrationsRun: process.env.NODE_ENV === 'production',
    retryAttempts: 3,
    retryDelay: 3000,
    maxQueryExecutionTime: 30000,
    extra: {
      max: Number.parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    },
  }),
);
