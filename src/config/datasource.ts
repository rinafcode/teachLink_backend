import { DataSource } from 'typeorm';
import { getDatabaseConfig } from './database.config';

export const AppDataSource = new DataSource({
  ...getDatabaseConfig(),
  synchronize: false,
  migrations: ['src/migrations/**/*.{ts,js}'],
  migrationsTableName: 'migrations',
});
