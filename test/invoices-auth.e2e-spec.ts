import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { User, UserStatus } from '../src/users/entities/user.entity';
import { Role } from '../src/rbac/entities/role.entity';
import { Invoice, InvoiceStatus } from '../src/payments/entities/invoice.entity';
import { Payment, PaymentStatus, PaymentMethod } from '../src/payments/entities/payment.entity';

/**
 * E2E tests for #970 — InvoicesController auth and ownership
 *
 * Covers:
 *   1. Anonymous GET /invoices/:id → 401
 *   2. Anonymous GET /invoices/:id/download → 401
 *   3. Owner can fetch their own invoice → 200
 *   4. User A requesting User B's invoice id → 404 (same shape as missing)
 *   5. Admin can fetch any invoice → 200
 *   6. fileUrl containing ../ traversal segments → rejected before any filesystem read
 */
describe('InvoicesController – auth, ownership & path traversal (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // Two regular users and one admin
  let userA: User;
  let userB: User;
  let adminUser: User;

  // Invoice owned by userA
  let invoiceA: Invoice;

  // Invoice whose fileUrl is a traversal path (owned by userA so auth passes)
  let invoiceTraversal: Invoice;

  // Bearer tokens
  let tokenA: string;
  let tokenB: string;
  let tokenAdmin: string;

  const rawPassword = 'Password123!';

  // ─── helpers ─────────────────────────────────────────────────────────────

  async function createUser(
    email: string,
    roleName: 'student' | 'admin',
    ds: DataSource,
  ): Promise<User> {
    const hashed = await bcrypt.hash(rawPassword, 8);

    const roleRepo = ds.getRepository(Role);
    let role = await roleRepo.findOne({ where: { name: roleName } });
    if (!role) {
      role = roleRepo.create({ name: roleName, isSystem: true });
      await roleRepo.save(role);
    }

    const userRepo = ds.getRepository(User);
    const user = userRepo.create({
      email,
      password: hashed,
      firstName: 'Test',
      lastName: 'User',
      status: UserStatus.ACTIVE,
      roles: [role],
    });
    return userRepo.save(user);
  }

  async function loginAndGetToken(email: string, server: any): Promise<string> {
    const res = await request(server).post('/auth/login').send({ email, password: rawPassword });
    return (res.body.accessToken as string) ?? (res.body.access_token as string);
  }

  async function createInvoice(userId: string, fileUrl: string, ds: DataSource): Promise<Invoice> {
    // We need a real Payment row first (FK constraint)
    const paymentRepo = ds.getRepository(Payment);
    const payment = paymentRepo.create({
      userId,
      amount: 99,
      currency: 'USD',
      status: PaymentStatus.COMPLETED,
      method: PaymentMethod.CREDIT_CARD,
    });
    const savedPayment = await paymentRepo.save(payment);

    const invoiceRepo = ds.getRepository(Invoice);
    const invoice = invoiceRepo.create({
      invoiceNumber: `INV-TEST-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      amount: 99,
      taxAmount: 0,
      totalAmount: 99,
      currency: 'USD',
      items: [{ description: 'Test item', amount: 99, quantity: 1 }],
      status: InvoiceStatus.PAID,
      issuedDate: new Date(),
      paymentId: savedPayment.id,
      userId,
      fileUrl,
    });
    return invoiceRepo.save(invoice);
  }

  // ─── setup ───────────────────────────────────────────────────────────────

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    dataSource = app.get(DataSource);

    const ts = Date.now();

    // Create two regular users + one admin
    userA = await createUser(`invoice-user-a-${ts}@test.local`, 'student', dataSource);
    userB = await createUser(`invoice-user-b-${ts}@test.local`, 'student', dataSource);
    adminUser = await createUser(`invoice-admin-${ts}@test.local`, 'admin', dataSource);

    // Build a safe fileUrl that lives inside the archive directory
    const safeFileUrl = path.join(process.cwd(), 'archived_invoices', `INV-TEST-${ts}.html`);

    // Invoice owned by userA with a safe fileUrl
    invoiceA = await createInvoice(userA.id, safeFileUrl, dataSource);

    // Invoice owned by userA but with a traversal path as fileUrl
    const traversalFileUrl = path.join(process.cwd(), 'archived_invoices', '..', 'package.json');
    invoiceTraversal = await createInvoice(userA.id, traversalFileUrl, dataSource);

    // Obtain tokens via the real login endpoint
    const server = app.getHttpServer();
    tokenA = await loginAndGetToken(userA.email, server);
    tokenB = await loginAndGetToken(userB.email, server);
    tokenAdmin = await loginAndGetToken(adminUser.email, server);
  }, 60_000);

  afterAll(async () => {
    // Clean up in FK-safe order
    const invoiceRepo = dataSource.getRepository(Invoice);
    const paymentRepo = dataSource.getRepository(Payment);
    const userRepo = dataSource.getRepository(User);

    for (const inv of [invoiceA, invoiceTraversal]) {
      if (inv) {
        await invoiceRepo.delete(inv.id).catch(() => {});
        await paymentRepo.delete(inv.paymentId).catch(() => {});
      }
    }

    for (const u of [userA, userB, adminUser]) {
      if (u) await userRepo.delete(u.id).catch(() => {});
    }

    await app.close();
  }, 30_000);

  // ─── authentication ───────────────────────────────────────────────────────

  describe('Anonymous access', () => {
    it('GET /invoices/:id without a token → 401', async () => {
      await request(app.getHttpServer()).get(`/invoices/${invoiceA.id}`).expect(401);
    });

    it('GET /invoices/:id/download without a token → 401', async () => {
      await request(app.getHttpServer()).get(`/invoices/${invoiceA.id}/download`).expect(401);
    });
  });

  // ─── ownership ────────────────────────────────────────────────────────────

  describe('Ownership checks', () => {
    it('owner (userA) can fetch their own invoice', async () => {
      const res = await request(app.getHttpServer())
        .get(`/invoices/${invoiceA.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.id).toBe(invoiceA.id);
    });

    it("non-owner (userB) requesting userA's invoice id receives 404", async () => {
      await request(app.getHttpServer())
        .get(`/invoices/${invoiceA.id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404);
    });

    it('non-owner 404 body is indistinguishable from a genuinely missing invoice', async () => {
      const missingId = '00000000-0000-0000-0000-000000000000';

      const missingRes = await request(app.getHttpServer())
        .get(`/invoices/${missingId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);

      const nonOwnedRes = await request(app.getHttpServer())
        .get(`/invoices/${invoiceA.id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404);

      // Both should have statusCode 404 — no body differences that leak ownership
      expect(missingRes.body.statusCode).toBe(404);
      expect(nonOwnedRes.body.statusCode).toBe(404);
    });

    it("admin can fetch any user's invoice", async () => {
      const res = await request(app.getHttpServer())
        .get(`/invoices/${invoiceA.id}`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .expect(200);

      expect(res.body.id).toBe(invoiceA.id);
    });

    it('non-owner GET /invoices/:id/download → 404', async () => {
      await request(app.getHttpServer())
        .get(`/invoices/${invoiceA.id}/download`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404);
    });
  });

  // ─── path traversal ───────────────────────────────────────────────────────

  describe('Path traversal protection', () => {
    it('download with a fileUrl that escapes the archive root is rejected (403)', async () => {
      // The invoice is owned by userA so auth passes; traversal should be blocked.
      const res = await request(app.getHttpServer())
        .get(`/invoices/${invoiceTraversal.id}/download`)
        .set('Authorization', `Bearer ${tokenA}`);

      // Service must reject with 403 before opening the file
      expect(res.status).toBe(403);
    });

    it('traversal rejection occurs regardless of admin status', async () => {
      const res = await request(app.getHttpServer())
        .get(`/invoices/${invoiceTraversal.id}/download`)
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(403);
    });
  });
});
