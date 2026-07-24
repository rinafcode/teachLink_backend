import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User, UserRole, UserStatus } from '../src/users/entities/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Role } from '../src/rbac/entities/role.entity';
const { authenticator } = require('otplib');

describe('MFA (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let roleRepository: Repository<Role>;
  let adminRole: Role;
  let adminUser: User;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    roleRepository = moduleFixture.get<Repository<Role>>(getRepositoryToken(Role));

    // Seed admin role
    adminRole = await roleRepository.findOne({ where: { name: UserRole.ADMIN } }) || 
      await roleRepository.save(roleRepository.create({ name: UserRole.ADMIN, description: 'Admin' }));

    // Seed admin user
    const salt = await bcrypt.genSalt(10);
    const password = await bcrypt.hash('password123', salt);
    adminUser = await userRepository.save(userRepository.create({
      email: 'mfa-admin@example.com',
      password,
      firstName: 'Mfa',
      lastName: 'Admin',
      status: UserStatus.ACTIVE,
      isEmailVerified: true,
      roles: [adminRole],
    }));
  });

  afterAll(async () => {
    if (adminUser) {
      await userRepository.delete(adminUser.id);
    }
    await app.close();
  });

  it('/auth/login (POST) - admin without MFA enabled successfully logs in (fallback to token issuance so they can setup)', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'mfa-admin@example.com', password: 'password123' })
      .expect(200);

    expect(response.body.accessToken).toBeDefined();
    accessToken = response.body.accessToken;
  });

  it('/mfa/setup (POST) - initiates MFA setup and returns QR code', async () => {
    const response = await request(app.getHttpServer())
      .post('/mfa/setup')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    expect(response.body.qrCodeDataUrl).toBeDefined();
    expect(response.body.recoveryCodes).toHaveLength(5);
  });

  it('/mfa/verify (POST) - verifies setup and enables MFA', async () => {
    const userInDb = await userRepository.findOneBy({ id: adminUser.id });
    
    const { EncryptionService } = require('../src/security/encryption/encryption.service');
    const encryptionService = app.get(EncryptionService);
    const secret = encryptionService.decrypt(JSON.parse(userInDb.totpSecret));
    const token = authenticator.generate(secret);

    await request(app.getHttpServer())
      .post('/mfa/verify')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: token })
      .expect(201);

    const verifiedUser = await userRepository.findOneBy({ id: adminUser.id });
    expect(verifiedUser.isMfaEnabled).toBe(true);
  });

  it('/auth/login (POST) - fails when MFA is enabled and no code is provided', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'mfa-admin@example.com', password: 'password123' })
      .expect(401);
  });

  it('/auth/login (POST) - fails with invalid MFA code', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'mfa-admin@example.com', password: 'password123', mfaCode: '000000' })
      .expect(401);
  });

  it('/auth/login (POST) - succeeds with valid MFA code', async () => {
    const userInDb = await userRepository.findOneBy({ id: adminUser.id });
    const { EncryptionService } = require('../src/security/encryption/encryption.service');
    const encryptionService = app.get(EncryptionService);
    const secret = encryptionService.decrypt(JSON.parse(userInDb.totpSecret));
    const token = authenticator.generate(secret);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'mfa-admin@example.com', password: 'password123', mfaCode: token })
      .expect(200);

    expect(response.body.accessToken).toBeDefined();
    accessToken = response.body.accessToken;
  });

  it('/mfa/disable (POST) - disables MFA with valid code', async () => {
    const userInDb = await userRepository.findOneBy({ id: adminUser.id });
    const { EncryptionService } = require('../src/security/encryption/encryption.service');
    const encryptionService = app.get(EncryptionService);
    const secret = encryptionService.decrypt(JSON.parse(userInDb.totpSecret));
    const token = authenticator.generate(secret);

    await request(app.getHttpServer())
      .post('/mfa/disable')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: token })
      .expect(201);

    const verifiedUser = await userRepository.findOneBy({ id: adminUser.id });
    expect(verifiedUser.isMfaEnabled).toBe(false);
  });
});
