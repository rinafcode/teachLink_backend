import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User, UserRole } from '../src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { ValidationPipe } from '@nestjs/common';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: 'localhost',
          port: 5432,
          username: 'test',
          password: 'test',
          database: 'test_db',
          entities: [User],
          synchronize: true,
        }),
        AppModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    userRepository = moduleFixture.get('UserRepository');
  });

  beforeEach(async () => {
    await userRepository.clear();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication', () => {
    const testUser = {
      email: 'test@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
    };

    describe('POST /auth/register', () => {
      it('should register a new user', () => {
        return request(app.getHttpServer())
          .post('/auth/register')
          .send(testUser)
          .expect(201)
          .expect((res) => {
            expect(res.body).toHaveProperty('access_token');
            expect(res.body).toHaveProperty('refresh_token');
          });
      });

      it('should not register a user with existing email', async () => {
        await request(app.getHttpServer())
          .post('/auth/register')
          .send(testUser)
          .expect(201);

        return request(app.getHttpServer())
          .post('/auth/register')
          .send(testUser)
          .expect(409);
      });
    });

    describe('POST /auth/login', () => {
      beforeEach(async () => {
        await request(app.getHttpServer())
          .post('/auth/register')
          .send(testUser)
          .expect(201);
      });

      it('should login with valid credentials', () => {
        return request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: testUser.email,
            password: testUser.password,
          })
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('access_token');
            expect(res.body).toHaveProperty('refresh_token');
          });
      });

      it('should not login with invalid credentials', () => {
        return request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: testUser.email,
            password: 'wrongpassword',
          })
          .expect(401);
      });
    });

    describe('POST /auth/refresh', () => {
      let refreshToken: string;

      beforeEach(async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send(testUser)
          .expect(201);
        refreshToken = response.body.refresh_token;
      });

      it('should refresh tokens with valid refresh token', () => {
        return request(app.getHttpServer())
          .post('/auth/refresh')
          .set('Authorization', `Bearer ${refreshToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('access_token');
            expect(res.body).toHaveProperty('refresh_token');
          });
      });

      it('should not refresh tokens with invalid refresh token', () => {
        return request(app.getHttpServer())
          .post('/auth/refresh')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);
      });
    });

    describe('POST /auth/logout', () => {
      let accessToken: string;

      beforeEach(async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/register')
          .send(testUser)
          .expect(201);
        accessToken = response.body.access_token;
      });

      it('should logout with valid access token', () => {
        return request(app.getHttpServer())
          .post('/auth/logout')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);
      });

      it('should not logout without access token', () => {
        return request(app.getHttpServer())
          .post('/auth/logout')
          .expect(401);
      });
    });

    describe('POST /auth/reset-password', () => {
      beforeEach(async () => {
        await request(app.getHttpServer())
          .post('/auth/register')
          .send(testUser)
          .expect(201);
      });

      it('should send reset password email', () => {
        return request(app.getHttpServer())
          .post('/auth/reset-password')
          .send({ email: testUser.email })
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('message');
          });
      });

      it('should not reveal if email exists', () => {
        return request(app.getHttpServer())
          .post('/auth/reset-password')
          .send({ email: 'nonexistent@example.com' })
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('message');
          });
      });
    });
  });
}); 