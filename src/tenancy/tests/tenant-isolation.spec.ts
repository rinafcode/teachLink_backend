import { IsolationService } from '../isolation/isolation.service';
import { TenantRlsSubscriber } from '../../middleware/tenant/tenant-rls.subscriber';
import { Tenant, TenantStatus, TenantPlan } from '../entities/tenant.entity';
import { ForbiddenOperationException } from '../../common/exceptions/app.exceptions';

function createMockRepo() {
  return {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  } as any;
}

function createMockIsolationService(tenantRepo: any): IsolationService {
  return new IsolationService(tenantRepo);
}

function createMockTenant(overrides: Partial<Tenant> = {}): Tenant {
  return {
    id: 'tenant-a-id',
    slug: 'school-a',
    name: 'School A',
    status: TenantStatus.ACTIVE,
    plan: TenantPlan.FREE,
    userLimit: 100,
    storageLimit: 1024,
    currentUserCount: 0,
    currentStorageUsage: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Tenant;
}

describe('Tenant Data Isolation', () => {
  let isolationService: IsolationService;
  let rlsSubscriber: TenantRlsSubscriber;
  let tenantRepo: any;

  const tenantA = createMockTenant({ id: 'tenant-a', slug: 'school-a', name: 'School A' });
  const tenantB = createMockTenant({ id: 'tenant-b', slug: 'school-b', name: 'School B' });

  beforeEach(() => {
    tenantRepo = createMockRepo();
    tenantRepo.findOne.mockImplementation(async (opts: any) => {
      if (opts.where.id === tenantA.id) return tenantA;
      if (opts.where.id === tenantB.id) return tenantB;
      if (opts.where.slug === tenantA.slug) return tenantA;
      if (opts.where.slug === tenantB.slug) return tenantB;
      return null;
    });
    isolationService = createMockIsolationService(tenantRepo);
    rlsSubscriber = new TenantRlsSubscriber(isolationService);
  });

  afterEach(() => {
    isolationService.clearTenant();
  });

  // ─── IsolationService ───────────────────────────────────────────────────

  describe('IsolationService', () => {
    it('should have no tenant context initially', () => {
      expect(isolationService.hasTenantContext()).toBe(false);
      expect(isolationService.getTenantId()).toBeNull();
      expect(isolationService.getTenant()).toBeNull();
    });

    it('should set and retrieve tenant context by id', async () => {
      await isolationService.setTenant(tenantA.id);
      expect(isolationService.hasTenantContext()).toBe(true);
      expect(isolationService.getTenantId()).toBe(tenantA.id);
      expect(isolationService.getTenant().name).toBe('School A');
    });

    it('should set tenant context by slug', async () => {
      await isolationService.setTenantBySlug(tenantB.slug);
      expect(isolationService.getTenantId()).toBe(tenantB.id);
      expect(isolationService.getTenant().name).toBe('School B');
    });

    it('should clear tenant context', async () => {
      await isolationService.setTenant(tenantA.id);
      isolationService.clearTenant();
      expect(isolationService.hasTenantContext()).toBe(false);
      expect(isolationService.getTenantId()).toBeNull();
    });

    it('should throw when setting non-existent tenant id', async () => {
      await expect(isolationService.setTenant('non-existent')).rejects.toThrow();
    });

    it('should throw when setting non-existent slug', async () => {
      await expect(isolationService.setTenantBySlug('non-existent')).rejects.toThrow();
    });

    it('should report active tenant correctly', async () => {
      await isolationService.setTenant(tenantA.id);
      expect(isolationService.isActiveTenant()).toBe(true);
    });

    it('should report inactive tenant correctly', async () => {
      const suspended = createMockTenant({
        id: 'tenant-c',
        slug: 'suspended',
        status: TenantStatus.SUSPENDED,
      });
      tenantRepo.findOne.mockResolvedValueOnce(suspended);
      await isolationService.setTenant('tenant-c');
      expect(isolationService.isActiveTenant()).toBe(false);
    });
  });

  // ─── TenantRlsSubscriber: Read Protection ──────────────────────────────

  describe('TenantRlsSubscriber - read protection', () => {
    it('should nullify cross-tenant entity data on load', async () => {
      await isolationService.setTenant(tenantA.id);
      const entity = { id: '1', tenantId: tenantB.id, email: 'bob@school-b.com', name: 'Bob' };
      rlsSubscriber.afterLoad(entity);
      expect(entity.tenantId).toBe(tenantB.id);
      expect(entity.email).toBeUndefined();
      expect(entity.name).toBeUndefined();
    });

    it('should not modify same-tenant entity data on load', async () => {
      await isolationService.setTenant(tenantA.id);
      const entity = { id: '1', tenantId: tenantA.id, email: 'alice@school-a.com', name: 'Alice' };
      rlsSubscriber.afterLoad(entity);
      expect(entity.email).toBe('alice@school-a.com');
      expect(entity.name).toBe('Alice');
    });

    it('should skip entities without tenantId field', async () => {
      await isolationService.setTenant(tenantA.id);
      const entity = { id: '1', title: 'Course without tenantId' };
      rlsSubscriber.afterLoad(entity);
      expect(entity.title).toBe('Course without tenantId');
    });

    it('should skip when no tenant context is set', () => {
      const entity = { id: '1', tenantId: tenantB.id, email: 'bob@school-b.com' };
      rlsSubscriber.afterLoad(entity);
      expect(entity.email).toBe('bob@school-b.com');
    });
  });

  // ─── TenantRlsSubscriber: Write Protection ─────────────────────────────

  describe('TenantRlsSubscriber - write protection', () => {
    it('should block insert of entity with foreign tenantId', async () => {
      await isolationService.setTenant(tenantA.id);
      const entity = { tenantId: tenantB.id, email: 'evil@school-b.com' };
      const event = { entity } as any;
      expect(() => rlsSubscriber.beforeInsert(event)).toThrow(ForbiddenOperationException);
    });

    it('should allow insert of entity with matching tenantId', async () => {
      await isolationService.setTenant(tenantA.id);
      const entity = { tenantId: tenantA.id, email: 'valid@school-a.com' };
      const event = { entity } as any;
      expect(() => rlsSubscriber.beforeInsert(event)).not.toThrow();
    });

    it('should auto-assign tenantId on insert when property exists but is undefined', async () => {
      await isolationService.setTenant(tenantA.id);
      const entity: any = { email: 'new@school-a.com', tenantId: undefined };
      const event = { entity } as any;
      rlsSubscriber.beforeInsert(event);
      expect(entity.tenantId).toBe(tenantA.id);
    });

    it('should block update of entity with foreign tenantId', async () => {
      await isolationService.setTenant(tenantA.id);
      const entity = { tenantId: tenantB.id };
      const event = { entity } as any;
      expect(() => rlsSubscriber.beforeUpdate(event)).toThrow(ForbiddenOperationException);
    });

    it('should block remove of entity with foreign tenantId', async () => {
      await isolationService.setTenant(tenantA.id);
      const entity = { tenantId: tenantB.id };
      const event = { entity } as any;
      expect(() => rlsSubscriber.beforeRemove(event)).toThrow(ForbiddenOperationException);
    });

    it('should skip enforcement for entities without tenantId', async () => {
      await isolationService.setTenant(tenantA.id);
      const entity = { title: 'Course without tenantId' };
      const event = { entity } as any;
      expect(() => rlsSubscriber.beforeInsert(event)).not.toThrow();
      expect(() => rlsSubscriber.beforeUpdate(event)).not.toThrow();
      expect(() => rlsSubscriber.beforeRemove(event)).not.toThrow();
    });

    it('should skip enforcement when no tenant context', () => {
      const entity = { tenantId: tenantB.id };
      const event = { entity } as any;
      expect(() => rlsSubscriber.beforeInsert(event)).not.toThrow();
      expect(() => rlsSubscriber.beforeUpdate(event)).not.toThrow();
      expect(() => rlsSubscriber.beforeRemove(event)).not.toThrow();
    });
  });

  // ─── Gap: Entities Without tenantId ─────────────────────────────────────
  //
  // Course, Enrollment, and Notification entities have no tenantId column.
  // The TenantRlsSubscriber only protects entities with a tenantId property.
  // Cross-tenant reads and writes on these entities are not blocked.
  //
  // Acceptance criteria requiring isolation for courses, enrollments, and
  // notifications cannot be satisfied without adding tenantId to those
  // entities and updating their respective services.
});
