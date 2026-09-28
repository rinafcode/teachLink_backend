import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';
import { ExperimentType } from '../../../ab-testing/entities/experiment.entity';

describe('A/B Testing Framework E2E Tests (Issue #548)', () => {
  let app: INestApplication;
  let authToken: string;
  let experimentId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // TODO: Setup test admin and get auth token
    authToken = 'test-admin-token';
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /ab-testing/templates - Experiment Templates', () => {
    it('should return available experiment templates', async () => {
      const response = await request(app.getHttpServer())
        .get('/ab-testing/templates')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      // Check standard template exists
      const standardTemplate = response.body.find((t: any) => t.name.includes('Standard'));
      expect(standardTemplate).toBeDefined();
      expect(standardTemplate).toHaveProperty('trafficAllocation');
      expect(standardTemplate).toHaveProperty('confidenceLevel');
      expect(standardTemplate).toHaveProperty('minimumSampleSize');
    });

    it('should include quick test template', async () => {
      const response = await request(app.getHttpServer())
        .get('/ab-testing/templates')
        .set('Authorization', `Bearer ${authToken}`);

      const quickTemplate = response.body.find((t: any) => t.name.includes('Quick'));
      expect(quickTemplate).toBeDefined();
      expect(quickTemplate.minimumSampleSize).toBeLessThan(1000);
    });

    it('should include high confidence template', async () => {
      const response = await request(app.getHttpServer())
        .get('/ab-testing/templates')
        .set('Authorization', `Bearer ${authToken}`);

      const highConfTemplate = response.body.find((t: any) => t.name.includes('High'));
      expect(highConfTemplate).toBeDefined();
      expect(highConfTemplate.confidenceLevel).toBe(0.99);
    });
  });

  describe('POST /ab-testing/experiments - Create Experiments', () => {
    it('should create experiment with template', async () => {
      const response = await request(app.getHttpServer())
        .post('/ab-testing/experiments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Homepage Button Color Test',
          description: 'Testing blue vs green CTA button',
          type: ExperimentType.FEATURE_FLAG,
          startDate: new Date(),
          hypothesis: 'Green button will increase conversions by 15%',
          templateName: 'standard',
          variants: [
            {
              name: 'Control (Blue)',
              description: 'Original blue button',
              configuration: { color: 'blue' },
              isControl: true,
            },
            {
              name: 'Treatment (Green)',
              description: 'Green button variant',
              configuration: { color: 'green' },
              isControl: false,
            },
          ],
          metrics: [
            {
              name: 'Click Through Rate',
              description: 'Percentage of users clicking the button',
              type: 'conversion',
              isPrimary: true,
            },
            {
              name: 'Page Engagement Time',
              description: 'Time spent on page',
              type: 'engagement',
              isPrimary: false,
            },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('draft');
      experimentId = response.body.id;
    });

    it('should create experiment with custom configuration', async () => {
      const response = await request(app.getHttpServer())
        .post('/ab-testing/experiments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Custom Configuration Test',
          description: 'Test with custom settings',
          type: ExperimentType.FEATURE_FLAG,
          startDate: new Date(),
          hypothesis: 'Testing a custom configuration',
          trafficAllocation: 75,
          autoAllocateTraffic: true,
          autoStopOnSignificance: true,
          significanceThreshold: 0.95,
          confidenceLevel: 0.95,
          minimumSampleSize: 2000,
          variants: [
            {
              name: 'Control',
              description: 'Control variant',
              configuration: { test: 'control' },
              isControl: true,
            },
            {
              name: 'Treatment',
              description: 'Treatment variant',
              configuration: { test: 'treatment' },
              isControl: false,
            },
          ],
          metrics: [
            {
              name: 'Primary Metric',
              description: 'Primary success metric',
              type: 'conversion',
              isPrimary: true,
            },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.trafficAllocation).toBe(75);
    });
  });

  describe('POST /ab-testing/experiments/:id/start - Start Experiment', () => {
    it('should start a draft experiment', async () => {
      const response = await request(app.getHttpServer())
        .post(`/ab-testing/experiments/${experimentId}/start`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('running');
    });

    it('should not allow starting already running experiment', async () => {
      const response = await request(app.getHttpServer())
        .post(`/ab-testing/experiments/${experimentId}/start`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /ab-testing/experiments/:id/analyze - Statistical Analysis', () => {
    it('should analyze experiment for statistical significance', async () => {
      const response = await request(app.getHttpServer())
        .post(`/ab-testing/experiments/${experimentId}/analyze`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('results');
      expect(Array.isArray(response.body.results)).toBe(true);

      // Check result structure
      const result = response.body.results[0];
      expect(result).toHaveProperty('variantId');
      expect(result).toHaveProperty('sampleSize');
      expect(result).toHaveProperty('conversionRate');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('pValue');
      expect(result).toHaveProperty('isSignificant');
      expect(result).toHaveProperty('uplift');
      expect(result).toHaveProperty('upliftCI');
    });

    it('should auto-stop experiment when significance reached', async () => {
      const response = await request(app.getHttpServer())
        .post(`/ab-testing/experiments/${experimentId}/analyze`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('shouldStop');
      expect(response.body).toHaveProperty('reason');
    });
  });

  describe('GET /ab-testing/experiments/:id/dashboard - Results Dashboard', () => {
    it('should return experiment results dashboard', async () => {
      const response = await request(app.getHttpServer())
        .get(`/ab-testing/experiments/${experimentId}/dashboard`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('experiment');
      expect(response.body).toHaveProperty('variantResults');
      expect(response.body).toHaveProperty('summary');
    });

    it('should include statistical metrics in dashboard', async () => {
      const response = await request(app.getHttpServer())
        .get(`/ab-testing/experiments/${experimentId}/dashboard`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const summary = response.body.summary;
      expect(summary).toHaveProperty('confidence');
      expect(summary).toHaveProperty('estimatedUplift');
      expect(summary).toHaveProperty('sampleSizeReached');

      // Winner should be identified if significant
      if (summary.sampleSizeReached) {
        expect(summary).toHaveProperty('winner');
      }
    });
  });

  describe('POST /ab-testing/experiments/:id/stop - Stop Experiment', () => {
    it('should stop a running experiment', async () => {
      const response = await request(app.getHttpServer())
        .post(`/ab-testing/experiments/${experimentId}/stop`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('completed');
    });
  });

  describe('GET /ab-testing/experiments - List Experiments', () => {
    it('should list all experiments', async () => {
      const response = await request(app.getHttpServer())
        .get('/ab-testing/experiments')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should not allow creating experiment without variants', async () => {
      const response = await request(app.getHttpServer())
        .post('/ab-testing/experiments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Invalid Test',
          description: 'Test without variants',
          type: ExperimentType.FEATURE_FLAG,
          startDate: new Date(),
          hypothesis: 'This will fail',
          variants: [],
          metrics: [],
        });

      expect(response.status).toBe(400);
    });

    it('should not allow starting experiment without exactly one control', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/ab-testing/experiments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'No Control Test',
          description: 'Test without control variant',
          type: ExperimentType.FEATURE_FLAG,
          startDate: new Date(),
          hypothesis: 'This will fail on start',
          variants: [
            {
              name: 'Variant 1',
              description: 'Treatment only',
              configuration: {},
              isControl: false,
            },
            {
              name: 'Variant 2',
              description: 'Another treatment',
              configuration: {},
              isControl: false,
            },
          ],
          metrics: [
            {
              name: 'Metric',
              description: 'Test metric',
              type: 'conversion',
              isPrimary: true,
            },
          ],
        });

      const id = createResponse.body.id;

      const startResponse = await request(app.getHttpServer())
        .post(`/ab-testing/experiments/${id}/start`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(startResponse.status).toBe(400);
    });
  });
});
