import { DataSource, DataSourceOptions } from 'typeorm';
import { getDatabaseConfig } from './database.config';

export const AppDataSource = new DataSource({
  ...(getDatabaseConfig() as DataSourceOptions),
  synchronize: false,
  migrations: ['src/migrations/**/*.{ts,js}'],
  migrationsTableName: 'migrations',
});
