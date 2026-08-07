import { Test, TestingModule } from '@nestjs/testing';
import { RbacCacheService } from './rbac-cache.service';
import Redis from 'ioredis-mock';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Permission } from './entities/permission.entity';
import { REDIS_CLIENT } from '../common/redis/redis.constants';

describe('RbacCacheService (Integration)', () => {
  let instance1: RbacCacheService;
  let instance2: RbacCacheService;
  let redisClient1: any;
  let redisClient2: any;
  let redisPublisher: any; // ioredis-mock uses a shared state

  beforeAll(async () => {
    // ioredis-mock shares state by default if no arguments are passed
    redisClient1 = new Redis();
    redisClient2 = redisClient1.createConnectedClient();

    const module1: TestingModule = await Test.createTestingModule({
      providers: [
        RbacCacheService,
        {
          provide: REDIS_CLIENT,
          useValue: redisClient1,
        },
        EventEmitter2,
      ],
    }).compile();

    const module2: TestingModule = await Test.createTestingModule({
      providers: [
        RbacCacheService,
        {
          provide: REDIS_CLIENT,
          useValue: redisClient2,
        },
        EventEmitter2,
      ],
    }).compile();

    instance1 = module1.get<RbacCacheService>(RbacCacheService);
    instance2 = module2.get<RbacCacheService>(RbacCacheService);

    await instance1.onModuleInit();
    await instance2.onModuleInit();
  });

  afterAll(async () => {
    await instance1.onModuleDestroy();
    await instance2.onModuleDestroy();
    redisClient1.disconnect();
    redisClient2.disconnect();
  });

  it('permission removal should propagate across two service instances immediately', async () => {
    const roleId = 'role-123';
    const permissions: Permission[] = [
      { id: 'p1', resource: 'user', action: 'read' } as Permission,
      { id: 'p2', resource: 'user', action: 'write' } as Permission,
    ];

    // Instance 1 caches the permissions
    await instance1.setRolePermissions(roleId, permissions);

    // Instance 2 reads them, hitting the redis cache and populating its local cache
    const instance2Read = await instance2.getRolePermissions(roleId);
    expect(instance2Read).toEqual(permissions);

    // Now permission 'p2' is removed, so we update the cache via instance 1
    const updatedPermissions = [permissions[0]];
    await instance1.setRolePermissions(roleId, updatedPermissions);

    // And instance 1 triggers an invalidation
    await instance1.invalidateRole(roleId);

    // Wait a brief moment for pub/sub to propagate
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Instance 2 should now read the updated permissions (or return null if deleted from Redis)
    // Actually, invalidateRole deletes from Redis. So next read should hit DB (which returns null in this test)
    const instance2ReadAfter = await instance2.getRolePermissions(roleId);

    // In our test, because we called setRolePermissions on instance1, it updated Redis.
    // But invalidateRole deletes it from Redis AND publishes the message.
    // Let's mimic what RolesService does:
    // RolesService updates DB, calls invalidateRole.

    expect(instance2ReadAfter).toBeNull();
  });
});
