import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/auth/guards/roles.guard';

describe('RolesController RBAC Security (e2e)', () => {
  let app: INestApplication;

  const mockJwtAuthGuard = {
    canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      const auth = req.headers.authorization;
      if (!auth) return false;
      if (auth === 'Bearer admin-token') {
        req.user = { id: 'admin-1', email: 'admin@test.com', roles: ['admin'] };
        return true;
      }
      if (auth === 'Bearer user-token') {
        req.user = { id: 'user-1', email: 'user@test.com', roles: ['user'] };
        return true;
      }
      return false;
    },
  };

  const mockRolesGuard = {
    canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      const user = req.user;
      if (!user) return false;
      if (user.roles?.includes('admin')) return true;
      return false;
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should return 401 Unauthorized for unauthenticated POST /roles', async () => {
    return request(app.getHttpServer())
      .post('/roles')
      .send({ name: 'hacker-role', description: 'Malicious role' })
      .expect(401);
  });

  it('should return 403 Forbidden for authenticated non-admin POST /roles', async () => {
    return request(app.getHttpServer())
      .post('/roles')
      .set('Authorization', 'Bearer user-token')
      .send({ name: 'hacker-role', description: 'Malicious role' })
      .expect(403);
  });
});
