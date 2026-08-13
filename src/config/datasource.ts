import { DataSource, DataSourceOptions } from 'typeorm';
import { getDatabaseConfig } from './database.config';

export const AppDataSource = new DataSource({
  ...(getDatabaseConfig() as DataSourceOptions),
  synchronize: false,
  // Load all entity files so schema-aware operations (migration:run,
  // migration:generate, the drift check) can compare the database against the
  // actual entity definitions. `!(migrations|modules)` excludes TypeORM
  // helpers under src/migrations and the (non-compiling, unregistered)
  // src/modules entities.
  entities: ['src/!(migrations|modules)/**/*.entity.ts'],
  // Match only timestamp-prefixed migration files. This deliberately excludes
  // non-migration helpers that live under src/migrations (e.g.
  // schema-migration.service.ts and the entities/ subdir) which TypeORM would
  // otherwise try to load as migrations and reject.
  migrations: ['src/migrations/[0-9]*.{ts,js}'],
  migrationsTableName: 'migrations',
});
