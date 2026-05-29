import { TypeOrmModuleOptions } from '@nestjs/typeorm';

/**
 * TypeORM connection options driven by DATABASE_* environment variables.
 */
export function getDatabaseConfig(): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    username: process.env.DATABASE_USER ?? 'postgres',
    password: process.env.DATABASE_PASSWORD ?? 'postgres',
    database: process.env.DATABASE_NAME ?? 'teachlink',
    autoLoadEntities: true,
    synchronize: process.env.NODE_ENV !== 'production',
  };
}
