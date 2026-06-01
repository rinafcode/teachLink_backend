import { Controller, Post, UseInterceptors } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Idempotent } from '../src/common/decorators/idempotency.decorator';
import { IdempotencyInterceptor } from '../src/common/interceptors/idempotency.interceptor';
import { IdempotencyModule } from '../src/common/modules/idempotency.module';
import { IDEMPOTENCY_REDIS_CLIENT } from '../src/common/constants/idempotency.constants';

class InMemoryRedisClient {
  private readonly store = new Map<string, { value: string; expiresAt: number | null }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: string, ...args: Array<string | number>): Promise<'OK' | null> {
    const normalizedArgs = args.map((arg) => String(arg));
    const nxIndex = normalizedArgs.indexOf('NX');
    const exIndex = normalizedArgs.indexOf('EX');
    const pxIndex = normalizedArgs.indexOf('PX');

    if (nxIndex >= 0 && this.store.has(key)) {
      const existing = await this.get(key);
      if (existing !== null) {
        return null;
      }
    }

    let expiresAt: number | null = null;
    if (exIndex >= 0) {
      expiresAt = Date.now() + Number(normalizedArgs[exIndex + 1]) * 1000;
    } else if (pxIndex >= 0) {
      expiresAt = Date.now() + Number(normalizedArgs[pxIndex + 1]);
    }

    this.store.set(key, { value, expiresAt });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      count += this.store.delete(key) ? 1 : 0;
    }
    return count;
  }

  async keys(pattern: string): Promise<string[]> {
    const matcher = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
    return [...this.store.keys()].filter((key) => matcher.test(key));
  }
}

@Controller('idempotency')
@UseInterceptors(IdempotencyInterceptor)
class IdempotencyTestController {
  private executions = 0;

  @Post('dedup')
  @Idempotent({ ttl: 60, waitTimeoutMs: 1000, pollIntervalMs: 25, lockTtlMs: 2000 })
  async createResource(): Promise<{ execution: number }> {
    this.executions += 1;
    await new Promise((resolve) => setTimeout(resolve, 150));
    return { execution: this.executions };
  }

  @Post('missing-header')
  @Idempotent()
  async requiresKey(): Promise<{ ok: boolean }> {
    return { ok: true };
  }

  @Post('custom-header')
  @Idempotent({ headerName: 'X-Custom-Idempotency-Key', ttl: 60 })
  async customHeader(): Promise<{ ok: boolean }> {
    return { ok: true };
  }
}

describe('Idempotency deduplication (e2e)', () => {
  let app: INestApplication;
  let redis: InMemoryRedisClient;

  beforeAll(async () => {
    redis = new InMemoryRedisClient();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), IdempotencyModule],
      controllers: [IdempotencyTestController],
    })
      .overrideProvider(IDEMPOTENCY_REDIS_CLIENT)
      .useValue(redis)
      .overrideProvider(ConfigService)
      .useValue({
        get: jest.fn((key: string, defaultValue?: unknown) => {
          if (key === 'IDEMPOTENCY_TTL_SECONDS') {
            return 60;
          }
          return defaultValue;
        }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the cached response for a repeated idempotent request', async () => {
    const first = await request(app.getHttpServer())
      .post('/idempotency/dedup')
      .set('Idempotency-Key', 'dedup-key-1')
      .send({ name: 'first' })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/idempotency/dedup')
      .set('Idempotency-Key', 'dedup-key-1')
      .send({ name: 'first' })
      .expect(201);

    expect(first.body).toEqual({ execution: 1 });
    expect(second.body).toEqual({ execution: 1 });
    expect(second.header['x-idempotent-replayed']).toBe('true');
  });

  it('accepts the legacy X-Idempotency-Key header as a fallback', async () => {
    const first = await request(app.getHttpServer())
      .post('/idempotency/dedup')
      .set('X-Idempotency-Key', 'dedup-key-legacy')
      .send({ name: 'legacy' })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/idempotency/dedup')
      .set('X-Idempotency-Key', 'dedup-key-legacy')
      .send({ name: 'legacy' })
      .expect(201);

    expect(first.body).toEqual({ execution: 2 });
    expect(second.body).toEqual({ execution: 2 });
  });

  it('deduplicates concurrent requests instead of processing them twice', async () => {
    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/idempotency/dedup')
        .set('Idempotency-Key', 'dedup-key-2')
        .send({ name: 'concurrent' }),
      request(app.getHttpServer())
        .post('/idempotency/dedup')
        .set('Idempotency-Key', 'dedup-key-2')
        .send({ name: 'concurrent' }),
    ]);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body).toEqual({ execution: 3 });
    expect(second.body).toEqual({ execution: 3 });
  });

  it('rejects requests that omit the idempotency header', async () => {
    const response = await request(app.getHttpServer()).post('/idempotency/missing-header').send({});

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Idempotency-Key header is required');
  });

  it('supports custom idempotency header names', async () => {
    const response = await request(app.getHttpServer())
      .post('/idempotency/custom-header')
      .set('X-Custom-Idempotency-Key', 'dedup-key-3')
      .send({})
      .expect(201);

    expect(response.body).toEqual({ ok: true });
  });

  it('rejects the same idempotency key when payload changes', async () => {
    await request(app.getHttpServer())
      .post('/idempotency/dedup')
      .set('Idempotency-Key', 'dedup-key-4')
      .send({ name: 'alpha' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/idempotency/dedup')
      .set('Idempotency-Key', 'dedup-key-4')
      .send({ name: 'beta' })
      .expect(409);

    expect(response.body.message).toContain('different payload');
  });
});
