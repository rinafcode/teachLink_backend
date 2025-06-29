import * as request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';

describe('Notifications e2e', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/notifications/preferences/:userId (POST) sets preferences', async () => {
    const res = await request(app.getHttpServer())
      .post('/notifications/preferences/user1')
      .send({ EMAIL: true, IN_APP: true })
      .expect(201);
    expect(res.body).toHaveProperty('success', true);
  });

  it('/notifications/:userId (GET) fetches notifications', async () => {
    const res = await request(app.getHttpServer())
      .get('/notifications/user1')
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
}); 