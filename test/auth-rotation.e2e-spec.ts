import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { User, UserRole, UserStatus } from '../src/users/entities/user.entity';
import * as bcrypt from 'bcrypt';
import { CachingService } from '../src/caching/caching.service';

describe('Auth Token Rotation (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let cachingService: CachingService;
  let testUser: User;
  const rawPassword = 'Password123!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    dataSource = app.get(DataSource);
    cachingService = app.get(CachingService);

    // Create a test user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(rawPassword, salt);

    testUser = new User();
    testUser.email = `test-${Date.now()}@example.com`;
    testUser.password = hashedPassword;
    testUser.firstName = 'Test';
    testUser.lastName = 'User';
    testUser.role = UserRole.STUDENT;
    testUser.status = UserStatus.ACTIVE;

    const userRepo = dataSource.getRepository(User);
    await userRepo.save(testUser);
  });

  afterAll(async () => {
    if (testUser) {
      const userRepo = dataSource.getRepository(User);
      await userRepo.delete(testUser.id);
    }
    await app.close();
  });

  it('/auth/login (POST) should return tokens', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: rawPassword,
      })
      .expect(200);

    expect(response.body.accessToken).toBeDefined();
    expect(response.body.refreshToken).toBeDefined();
  });

  it('should successfully refresh tokens and rotate them', async () => {
    // 1. Login to get initial tokens
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testUser.email, password: rawPassword })
      .expect(200);

    const initialRefreshToken = loginResponse.body.refreshToken;

    // 2. Refresh tokens
    const startTime = process.hrtime();
    const refreshResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: initialRefreshToken })
      .expect(200);
    const endTime = process.hrtime(startTime);

    const executionTimeMs = endTime[0] * 1000 + endTime[1] / 1000000;
    console.log(`Refresh token execution time: ${executionTimeMs}ms`);

    const newRefreshToken = refreshResponse.body.refreshToken;
    expect(newRefreshToken).toBeDefined();
    expect(newRefreshToken).not.toEqual(initialRefreshToken);

    // 3. Attempt to use the old refresh token (should be blocked and revoke current tokens)
    const blockedResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: initialRefreshToken })
      .expect(401);

    expect(blockedResponse.body.message).toEqual('Token has been revoked');

    // 4. Verify lookup performance < 10ms (approximate via test logic)
    // Since this incorporates network overhead, we do a direct service lookup check to be sure
    const directStart = process.hrtime();
    // Simulate direct blacklist check performance
    // We decode the token here just to test the lookup
    const decoded: any = JSON.parse(
      Buffer.from(initialRefreshToken.split('.')[1], 'base64').toString(),
    );
    const isBlacklisted = await cachingService.get(`bl_token:${decoded.jti}`);
    const directEnd = process.hrtime(directStart);
    const directTimeMs = directEnd[0] * 1000 + directEnd[1] / 1000000;

    expect(isBlacklisted).toEqual('revoked');
    expect(directTimeMs).toBeLessThan(10);
    console.log(`Direct Redis lookup time: ${directTimeMs}ms`);
  });
});
