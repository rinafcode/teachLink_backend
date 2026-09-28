import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { DataSource } from 'typeorm';
import { getDatabaseConfig } from '../src/config/database.config';

import { Cohort } from '../src/cohorts/entities/cohort.entity';
import { CohortMember } from '../src/cohorts/entities/cohort-member.entity';
import { CohortThread } from '../src/cohorts/entities/cohort-thread.entity';
import { CohortComment } from '../src/cohorts/entities/cohort-comment.entity';
import { CohortAssignment } from '../src/cohorts/entities/cohort-assignment.entity';

import { UnsubscribeToken } from '../src/email-unsubscribe/entities/unsubscribe-token.entity';
import { EmailSubscription } from '../src/email-marketing/entities/email-subscription.entity';

import { Tenant } from '../src/tenancy/entities/tenant.entity';
import { TenantConfig } from '../src/tenancy/entities/tenant-config.entity';
import { TenantBilling } from '../src/tenancy/entities/tenant-billing.entity';
import { TenantCustomization } from '../src/tenancy/entities/tenant-customization.entity';

import { Achievement } from '../src/achievements/entities/achievement.entity';
import { AchievementProgress } from '../src/achievements/entities/achievement-progress.entity';
import { UserAchievement } from '../src/achievements/entities/user-achievement.entity';
import { AchievementStatistics } from '../src/achievements/entities/achievement-statistics.entity';

import { Notification } from '../src/notifications/entities/notification.entity';
import { User } from '../src/users/entities/user.entity';
import { Role } from '../src/rbac/entities/role.entity';
import { Permission } from '../src/rbac/entities/permission.entity';
import { Course } from '../src/courses/entities/course.entity';
import { CourseModule } from '../src/courses/entities/course-module.entity';
import { CourseReview } from '../src/courses/entities/course-review.entity';
import { CourseVersion } from '../src/courses/entities/course-version.entity';
import { Lesson } from '../src/courses/entities/lesson.entity';
import { Enrollment } from '../src/courses/entities/enrollment.entity';

import { CohortsService } from '../src/cohorts/cohorts.service';
import { EmailUnsubscribeService } from '../src/email-unsubscribe/email-unsubscribe.service';
import { TenantAdminService } from '../src/tenancy/admin/tenant-admin.service';
import { AchievementsService } from '../src/achievements/achievements.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { PreferencesService } from '../src/notifications/preferences/preferences.service';
import { NotificationTemplateService } from '../src/notifications/templates/notification-template.service';

/**
 * Transactional writes (issue #1344).
 *
 * Every listed multi-write operation must commit or roll back atomically. Each
 * rollback test installs a PostgreSQL trigger that makes a LATER write in the
 * sequence fail, then asserts the earlier write was rolled back with it.
 */
describe('Transactional writes (#1344)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let cohortsService: CohortsService;
  let unsubscribeService: EmailUnsubscribeService;
  let tenantAdminService: TenantAdminService;
  let achievementsService: AchievementsService;
  let notificationsService: NotificationsService;

  const userId = '00000000-0000-4000-8000-000000000001';
  const tenantId = '00000000-0000-4000-8000-000000000003';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          ...getDatabaseConfig(),
          entities: [
            Cohort,
            CohortMember,
            CohortThread,
            CohortComment,
            CohortAssignment,
            UnsubscribeToken,
            EmailSubscription,
            Tenant,
            TenantConfig,
            TenantBilling,
            TenantCustomization,
            Achievement,
            AchievementProgress,
            UserAchievement,
            AchievementStatistics,
            Notification,
            User,
            Role,
            Permission,
            Course,
            CourseModule,
            CourseReview,
            CourseVersion,
            Lesson,
            Enrollment,
          ],
          synchronize: false,
        }),
        TypeOrmModule.forFeature([
          Cohort,
          CohortMember,
          CohortThread,
          CohortComment,
          CohortAssignment,
          UnsubscribeToken,
          EmailSubscription,
          Tenant,
          TenantConfig,
          TenantBilling,
          TenantCustomization,
          Achievement,
          AchievementProgress,
          UserAchievement,
          AchievementStatistics,
          Notification,
          User,
          Role,
          Permission,
          Course,
          CourseModule,
          CourseReview,
          CourseVersion,
          Lesson,
          Enrollment,
        ]),
      ],
      providers: [
        CohortsService,
        EmailUnsubscribeService,
        TenantAdminService,
        AchievementsService,
        NotificationsService,
        {
          provide: CACHE_MANAGER,
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
        },
        {
          provide: PreferencesService,
          useValue: {
            getPreferences: jest.fn().mockResolvedValue({
              globalUnsubscribe: false,
              inAppEnabled: true,
              emailEnabled: true,
              pushEnabled: true,
              smsEnabled: true,
            }),
          },
        },
        { provide: NotificationTemplateService, useValue: {} },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    cohortsService = app.get(CohortsService);
    unsubscribeService = app.get(EmailUnsubscribeService);
    tenantAdminService = app.get(TenantAdminService);
    achievementsService = app.get(AchievementsService);
    notificationsService = app.get(NotificationsService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query('DELETE FROM cohort_members');
    await dataSource.query('DELETE FROM cohorts');
    await dataSource.query('DELETE FROM email_subscriptions');
    await dataSource.query('DELETE FROM unsubscribe_tokens');
    await dataSource.query('DELETE FROM user_achievements');
    await dataSource.query('DELETE FROM achievement_progress');
    await dataSource.query('DELETE FROM achievements');
    await dataSource.query('DELETE FROM notifications');
    await dataSource.query('DELETE FROM tenant_billing');
    await dataSource.query('DELETE FROM tenants');
    await dataSource.query('DELETE FROM users');
  });

  /** Installs a trigger that fails the write to `table`, then always removes it. */
  async function withFailTrigger(
    table: string,
    event: 'INSERT' | 'UPDATE',
    body: () => Promise<void>,
    condition?: string,
  ) {
    const name = `test_force_fail_${table.replace(/[^a-z0-9_]/gi, '')}`;
    const trigger = `trg_${name}`;

    await dataSource.query(`
      CREATE OR REPLACE FUNCTION ${name}() RETURNS trigger AS $$
      BEGIN
        ${condition ?? `RAISE EXCEPTION 'forced write failure for test (${table})';`}
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await dataSource.query(
      `CREATE TRIGGER ${trigger} BEFORE ${event} ON ${table} FOR EACH ROW EXECUTE FUNCTION ${name}();`,
    );
    try {
      await body();
    } finally {
      await dataSource.query(`DROP TRIGGER IF EXISTS ${trigger} ON ${table}`);
      await dataSource.query(`DROP FUNCTION IF EXISTS ${name}();`);
    }
  }

  describe('cohorts.createCohort', () => {
    it('rolls back the cohort when the owner membership write fails', async () => {
      await withFailTrigger('cohort_members', 'INSERT', async () => {
        await expect(
          cohortsService.createCohort({ name: 'Ops', description: 'd' }, userId),
        ).rejects.toThrow('forced write failure');
      });

      const rows = await dataSource.query(
        'SELECT COUNT(*)::int AS count FROM cohorts WHERE "ownerId" = $1',
        [userId],
      );
      expect(rows[0].count).toBe(0);
    });

    it('commits the cohort together with its owner membership', async () => {
      const cohort = await cohortsService.createCohort({ name: 'Ops', description: 'd' }, userId);

      const cohortRows = await dataSource.query(
        'SELECT COUNT(*)::int AS count FROM cohorts WHERE id = $1',
        [cohort.id],
      );
      const memberRows = await dataSource.query(
        'SELECT COUNT(*)::int AS count FROM cohort_members WHERE "cohortId" = $1 AND "userId" = $2 AND role = $3',
        [cohort.id, userId, 'owner'],
      );
      expect(cohortRows[0].count).toBe(1);
      expect(memberRows[0].count).toBe(1);
    });
  });

  describe('email-unsubscribe.unsubscribe', () => {
    const token = 'test-unsubscribe-token';

    const seedToken = async () => {
      await dataSource.query(
        `INSERT INTO unsubscribe_tokens (id, token, email, used, "expiresAt")
         VALUES (gen_random_uuid(), $1, $2, false, now() + interval '1 day')`,
        [token, 'user@example.com'],
      );
    };

    it('rolls back token consumption when the subscription write fails', async () => {
      await seedToken();

      await withFailTrigger('email_subscriptions', 'INSERT', async () => {
        await expect(unsubscribeService.unsubscribe({ token })).rejects.toThrow(
          'forced write failure',
        );
      });

      const rows = await dataSource.query(
        'SELECT used::boolean AS used FROM unsubscribe_tokens WHERE token = $1',
        [token],
      );
      expect(rows[0].used).toBe(false);
    });

    it('consumes the token and unsubscribes the address together', async () => {
      await seedToken();

      await unsubscribeService.unsubscribe({ token });

      const tokenRows = await dataSource.query(
        'SELECT used::boolean AS used FROM unsubscribe_tokens WHERE token = $1',
        [token],
      );
      const subRows = await dataSource.query(
        `SELECT "isSubscribed"::boolean AS subscribed FROM email_subscriptions
         WHERE email = $1`,
        ['user@example.com'],
      );
      expect(tokenRows[0].used).toBe(true);
      expect(subRows).toHaveLength(1);
      expect(subRows[0].subscribed).toBe(false);
    });
  });

  describe('achievements.unlockAchievement', () => {
    const achievementId = '00000000-0000-4000-8000-000000000002';

    const seedUser = async () => {
      await dataSource.query(
        `INSERT INTO users (id, version, email, "firstName", "lastName")
         VALUES ($1, 1, 'tx-achievements@example.com', 'Tx', 'Test')`,
        [userId],
      );
    };

    const seedAchievement = async () => {
      await dataSource.query(
        `INSERT INTO achievements (id, version, name, description, "iconUrl", type, difficulty, "pointsReward", "experienceReward", "isActive", "unlockedBy")
         VALUES ($1, 1, 'First Step', 'desc', 'icon.png', 'milestone', 'easy', 100, 50, true, 0)`,
        [achievementId],
      );
    };

    const seedProgress = async () => {
      await dataSource.query(
        `INSERT INTO achievement_progress (id, version, "userId", "achievementId", "currentProgress", "targetProgress", "percentageComplete", "isUnlocked")
         VALUES (gen_random_uuid(), 1, $1, $2, 1, 1, 100, false)`,
        [userId, achievementId],
      );
    };

    it('rolls back the unlock row when the progress update fails', async () => {
      await seedUser();
      await seedAchievement();
      await seedProgress();

      await withFailTrigger('achievement_progress', 'UPDATE', async () => {
        await expect(achievementsService.unlockAchievement(userId, achievementId)).rejects.toThrow(
          'forced write failure',
        );
      });

      const unlocks = await dataSource.query(
        'SELECT COUNT(*)::int AS count FROM user_achievements WHERE "userId" = $1',
        [userId],
      );
      const achievement = await dataSource.query(
        'SELECT "unlockedBy"::int AS n FROM achievements WHERE id = $1',
        [achievementId],
      );
      const progress = await dataSource.query(
        'SELECT "isUnlocked"::boolean AS unlocked FROM achievement_progress WHERE "userId" = $1 AND "achievementId" = $2',
        [userId, achievementId],
      );
      expect(unlocks[0].count).toBe(0);
      expect(achievement[0].n).toBe(0);
      expect(progress[0].unlocked).toBe(false);
    });

    it('commits the unlock, progress flag and counter together', async () => {
      await seedUser();
      await seedAchievement();
      await seedProgress();

      await achievementsService.unlockAchievement(userId, achievementId);

      const unlocks = await dataSource.query(
        'SELECT COUNT(*)::int AS count FROM user_achievements WHERE "userId" = $1',
        [userId],
      );
      const achievement = await dataSource.query(
        'SELECT "unlockedBy"::int AS n FROM achievements WHERE id = $1',
        [achievementId],
      );
      const progress = await dataSource.query(
        'SELECT "isUnlocked"::boolean AS unlocked FROM achievement_progress WHERE "userId" = $1 AND "achievementId" = $2',
        [userId, achievementId],
      );
      expect(unlocks[0].count).toBe(1);
      expect(achievement[0].n).toBe(1);
      expect(progress[0].unlocked).toBe(true);
    });
  });

  describe('notifications.send', () => {
    const seedUser = async () => {
      await dataSource.query(
        `INSERT INTO users (id, version, email, "firstName", "lastName")
         VALUES ($1, 1, 'tx-test@example.com', 'Tx', 'Test')`,
        [userId],
      );
    };

    it('rolls back every dispatch when a later channel write fails', async () => {
      await seedUser();

      await withFailTrigger(
        'notifications',
        'INSERT',
        async () => {
          await expect(
            notificationsService.send({
              userId,
              title: 'Hello',
              content: 'World',
            }),
          ).rejects.toThrow('forced write failure');
        },
        `IF (SELECT count(*) FROM notifications WHERE "userId" = NEW."userId") >= 1 THEN
            RAISE EXCEPTION 'forced write failure for test (notifications)';
         END IF;`,
      );

      const rows = await dataSource.query(
        'SELECT COUNT(*)::int AS count FROM notifications WHERE "userId" = $1',
        [userId],
      );
      expect(rows[0].count).toBe(0);
    });

    it('persists the base notification and every enabled channel', async () => {
      await seedUser();

      await notificationsService.send({ userId, title: 'Hello', content: 'World' });

      const rows = await dataSource.query(
        'SELECT COUNT(*)::int AS count FROM notifications WHERE "userId" = $1',
        [userId],
      );
      // base (in-app default) + in_app + email + push + sms
      expect(rows[0].count).toBe(5);
    });
  });

  describe('tenant-admin.resetTenantData', () => {
    const seedTenant = async () => {
      await dataSource.query(
        `INSERT INTO tenants (id, version, slug, name, status, plan, "userLimit", "currentUserCount", "storageLimit", "currentStorageUsage")
         VALUES ($1, 1, 'tx-tenant', 'Tx Tenant', 'active', 'free', 100, 5, 1000, 42)`,
        [tenantId],
      );
      await dataSource.query(
        `INSERT INTO tenant_billing (id, version, "tenantId", "billingCycle", "monthlyFee", "currentBalance", "totalPaid", "usageMetrics")
         VALUES (gen_random_uuid(), 1, $1, 'monthly', 0, 12.5, 50, '{"activeUsers":5,"storageUsed":42}')`,
        [tenantId],
      );
    };

    it('rolls back the tenant counters when the billing write fails', async () => {
      await seedTenant();

      await withFailTrigger('tenant_billing', 'UPDATE', async () => {
        await expect(tenantAdminService.resetTenantData(tenantId)).rejects.toThrow(
          'forced write failure',
        );
      });

      const tenant = await dataSource.query(
        'SELECT "currentUserCount"::int AS users, "currentStorageUsage"::int AS storage FROM tenants WHERE id = $1',
        [tenantId],
      );
      const billing = await dataSource.query(
        'SELECT "usageMetrics"::text AS metrics FROM tenant_billing WHERE "tenantId" = $1',
        [tenantId],
      );
      expect(tenant[0].users).toBe(5);
      expect(tenant[0].storage).toBe(42);
      expect(JSON.parse(billing[0].metrics).activeUsers).toBe(5);
    });

    it('resets the tenant counters and billing usage together', async () => {
      await seedTenant();

      await tenantAdminService.resetTenantData(tenantId);

      const tenant = await dataSource.query(
        'SELECT "currentUserCount"::int AS users, "currentStorageUsage"::int AS storage FROM tenants WHERE id = $1',
        [tenantId],
      );
      const billing = await dataSource.query(
        'SELECT "usageMetrics"::text AS metrics FROM tenant_billing WHERE "tenantId" = $1',
        [tenantId],
      );
      expect(tenant[0].users).toBe(0);
      expect(tenant[0].storage).toBe(0);
      expect(JSON.parse(billing[0].metrics)).toEqual({});
    });
  });
});
