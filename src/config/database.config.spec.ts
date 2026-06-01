import { getDatabaseConfig, getReadReplicaConnections } from './database.config';

const originalEnv = process.env;

describe('database config read replicas', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.DATABASE_REPLICA_URLS;
    delete process.env.DATABASE_REPLICA_HOSTS;
    delete process.env.DATABASE_REPLICA_PORTS;
    delete process.env.DATABASE_REPLICA_USER;
    delete process.env.DATABASE_REPLICA_PASSWORD;
    delete process.env.DATABASE_REPLICA_NAME;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('keeps a single primary connection when no replicas are configured', () => {
    const config = getDatabaseConfig() as Record<string, unknown>;

    expect(config.type).toBe('postgres');
    expect(config.host).toBe('localhost');
    expect(config.replication).toBeUndefined();
  });

  it('builds TypeORM replication settings from replica URLs', () => {
    process.env.DATABASE_HOST = 'primary.db';
    process.env.DATABASE_USER = 'primary-user';
    process.env.DATABASE_PASSWORD = 'primary-password';
    process.env.DATABASE_NAME = 'teachlink';
    process.env.DATABASE_REPLICA_URLS =
      'postgres://read1:pass1@replica-1.db:5433/teachlink, postgres://read2:pass2@replica-2.db/teachlink';

    const config = getDatabaseConfig() as any;

    expect(config.replication.master).toMatchObject({
      host: 'primary.db',
      username: 'primary-user',
      password: 'primary-password',
      database: 'teachlink',
    });
    expect(config.replication.slaves).toEqual([
      {
        host: 'replica-1.db',
        port: 5433,
        username: 'read1',
        password: 'pass1',
        database: 'teachlink',
      },
      {
        host: 'replica-2.db',
        port: 5432,
        username: 'read2',
        password: 'pass2',
        database: 'teachlink',
      },
    ]);
  });

  it('builds replica connections from host lists with primary defaults', () => {
    process.env.DATABASE_REPLICA_HOSTS = 'replica-a.db,replica-b.db';
    process.env.DATABASE_REPLICA_PORTS = '5433,5434';

    expect(
      getReadReplicaConnections({
        host: 'primary.db',
        port: 5432,
        username: 'app',
        password: 'secret',
        database: 'teachlink',
      }),
    ).toEqual([
      {
        host: 'replica-a.db',
        port: 5433,
        username: 'app',
        password: 'secret',
        database: 'teachlink',
      },
      {
        host: 'replica-b.db',
        port: 5434,
        username: 'app',
        password: 'secret',
        database: 'teachlink',
      },
    ]);
  });
});
