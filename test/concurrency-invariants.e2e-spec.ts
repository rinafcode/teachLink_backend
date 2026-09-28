import { INestApplication, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { getDatabaseConfig } from '../src/config/database.config';

import { Course } from '../src/courses/entities/course.entity';
import { Enrollment } from '../src/courses/entities/enrollment.entity';
import { CourseModule } from '../src/courses/entities/course-module.entity';
import { CourseReview } from '../src/courses/entities/course-review.entity';
import { CourseVersion } from '../src/courses/entities/course-version.entity';
import { Lesson } from '../src/courses/entities/lesson.entity';
import { User } from '../src/users/entities/user.entity';
import { Role } from '../src/rbac/entities/role.entity';
import { Permission } from '../src/rbac/entities/permission.entity';

import { Tenant } from '../src/tenancy/entities/tenant.entity';
import { TenantConfig } from '../src/tenancy/entities/tenant-config.entity';
import { TenantBilling } from '../src/tenancy/entities/tenant-billing.entity';
import { TenantCustomization } from '../src/tenancy/entities/tenant-customization.entity';

import { EnrollmentsService } from '../src/courses/enrollments.service';
import { OutboxService } from '../src/common/events/outbox.service';
import { TenancyService } from '../src/tenancy/tenancy.service';
import { TenantBillingService } from '../src/tenancy/billing/tenant-billing.service';
import { CustomizationService } from '../src/tenancy/customization/customization.service';

/**
 * Concurrency invariants (issue #1343).
 *
 * Runs against a real PostgreSQL database (the CI `validate` job starts one):
 *   - duplicate enrollments are rejected by the partial unique index, so
 *     concurrent enroll requests produce exactly one active enrollment;
 *   - tenant seat consumption is atomic, so concurrent registrations can never
 *     push `currentUserCount` past `userLimit`.
 */
describe('Concurrency invariants (#1343)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let enrollmentsService: EnrollmentsService;
  let tenancyService: TenancyService;

  const userId = '00000000-0000-4000-8000-000000000001';
  const courseId = '00000000-0000-4000-8000-000000000002';
  const tenantId = '00000000-0000-4000-8000-000000000003';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          ...getDatabaseConfig(),
          entities: [
            Course,
            CourseModule,
            CourseReview,
            CourseVersion,
            Lesson,
            Enrollment,
            User,
            Role,
            Permission,
            Tenant,
            TenantConfig,
            TenantBilling,
            TenantCustomization,
          ],
          synchronize: false,
        }),
        TypeOrmModule.forFeature([
          Course,
          Enrollment,
          User,
          Tenant,
          TenantConfig,
          TenantBilling,
          TenantCustomization,
        ]),
      ],
      providers: [
        EnrollmentsService,
        { provide: OutboxService, useValue: { enqueue: jest.fn(), enqueueStandalone: jest.fn() } },
        TenancyService,
        { provide: TenantBillingService, useValue: {} },
        { provide: CustomizationService, useValue: {} },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    enrollmentsService = app.get(EnrollmentsService);
    tenancyService = app.get(TenancyService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query('DELETE FROM enrollment');
    await dataSource.query('DELETE FROM course');
    await dataSource.query('DELETE FROM users');
    await dataSource.query('DELETE FROM tenants');
  });

  const seedCourse = async () => {
    await dataSource.query(
      `INSERT INTO course (id, version, title, description, price, status, instructor_id)
       VALUES ($1, 1, 'Concurrency Course', 'desc', 0, 'published', 'instructor-1')`,
      [courseId],
    );
  };

  const seedTenant = async (userLimit: number) => {
    await dataSource.query(
      `INSERT INTO tenants (id, version, slug, name, status, plan, "userLimit", "currentUserCount", "storageLimit", "currentStorageUsage")
       VALUES ($1, 1, 'concurrency-tenant', 'Concurrency Tenant', 'active', 'free', $2, 0, 100, 0)`,
      [tenantId, userLimit],
    );
  };

  describe('enrollments', () => {
    it('allows exactly one active enrollment under concurrent duplicate requests', async () => {
      await seedCourse();

      const attempts = Array.from({ length: 5 }, () => enrollmentsService.enroll(userId, courseId));
      const results = await Promise.allSettled(attempts);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(4);
      for (const r of rejected) {
        expect((r as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
      }

      const rows = await dataSource.query(
        'SELECT COUNT(*)::int AS count FROM enrollment WHERE user_id = $1 AND course_id = $2',
        [userId, courseId],
      );
      expect(rows[0].count).toBe(1);
    });

    it('surfaces duplicate-enrollment attempts as 409 (ConflictException)', async () => {
      await seedCourse();

      await enrollmentsService.enroll(userId, courseId);
      await expect(enrollmentsService.enroll(userId, courseId)).rejects.toBeInstanceOf(
        ConflictException,
      );

      const rows = await dataSource.query(
        'SELECT COUNT(*)::int AS count FROM enrollment WHERE user_id = $1 AND course_id = $2',
        [userId, courseId],
      );
      expect(rows[0].count).toBe(1);
    });

    it('allows re-enrollment after the previous enrollment is soft-deleted', async () => {
      await seedCourse();

      const enrollment = await enrollmentsService.enroll(userId, courseId);
      // Simulate unenroll (soft delete).
      await dataSource.query('UPDATE enrollment SET "deletedAt" = now() WHERE id = $1', [
        enrollment.id,
      ]);

      await expect(enrollmentsService.enroll(userId, courseId)).resolves.toBeDefined();

      const rows = await dataSource.query(
        'SELECT COUNT(*)::int AS count FROM enrollment WHERE user_id = $1 AND course_id = $2',
        [userId, courseId],
      );
      expect(rows[0].count).toBe(2); // one soft-deleted + one active
    });
  });

  describe('tenant limits', () => {
    it('never lets concurrent seat consumption exceed the user limit', async () => {
      const userLimit = 2;
      await seedTenant(userLimit);

      const attempts = Array.from({ length: 8 }, () =>
        dataSource.transaction((manager) => tenancyService.consumeUserSeat(manager, tenantId)),
      );
      const results = await Promise.all(attempts);

      expect(results.filter(Boolean)).toHaveLength(userLimit);

      const rows = await dataSource.query(
        'SELECT "currentUserCount"::int AS count FROM tenants WHERE id = $1',
        [tenantId],
      );
      expect(rows[0].count).toBe(userLimit);
    });

    it('treats an unlimited tenant (userLimit = -1) as always accepting seats', async () => {
      await seedTenant(-1);

      const attempts = Array.from({ length: 5 }, () =>
        dataSource.transaction((manager) => tenancyService.consumeUserSeat(manager, tenantId)),
      );
      const results = await Promise.all(attempts);

      expect(results.every(Boolean)).toBe(true);

      const rows = await dataSource.query(
        'SELECT "currentUserCount"::int AS count FROM tenants WHERE id = $1',
        [tenantId],
      );
      expect(rows[0].count).toBe(5);
    });
  });
});
