import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DeepLinkModule } from '../src/deep-link/deep-link.module';

describe('DeepLinkController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [DeepLinkModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /.well-known/apple-app-site-association should return valid AASA', async () => {
    const response = await request(app.getHttpServer())
      .get('/.well-known/apple-app-site-association')
      .expect(200);

    expect(response.body).toHaveProperty('applinks');
    expect(response.body.applinks.details[0].appID).toBe('TEAMID.com.teachlink.app');
  });

  it('GET /.well-known/assetlinks.json should return valid Android intent configuration', async () => {
    const response = await request(app.getHttpServer())
      .get('/.well-known/assetlinks.json')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body[0].target.package_name).toBe('com.teachlink.app');
  });

  it('GET /deep-link/course/:id should redirect to web route for desktop user-agent', async () => {
    const response = await request(app.getHttpServer())
      .get('/deep-link/course/123')
      .set('user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
      .expect(302);

    expect(response.header.location).toBe('/course/123');
  });

  it('GET /deep-link/course/:id should redirect to custom scheme for mobile user-agent', async () => {
    const response = await request(app.getHttpServer())
      .get('/deep-link/course/456')
      .set('user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)')
      .expect(302);

    expect(response.header.location).toBe('teachlink://course/456');
  });
});
