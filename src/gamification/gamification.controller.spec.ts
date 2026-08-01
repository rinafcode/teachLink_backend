import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { GamificationController } from './gamification.controller';
import { PointsService } from './points/points.service';
import { LeaderboardService } from './leaderboards/leaderboards.service';
import { TiersService } from './tiers/tiers.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PointActivityType } from './enums/point-activity.enum';

describe('GamificationController', () => {
  let app: INestApplication;

  const mockPointsService = {
    addPoints: jest.fn().mockResolvedValue({}),
    awardActivity: jest.fn().mockResolvedValue({}),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [GamificationController],
      providers: [
        { provide: PointsService, useValue: mockPointsService },
        { provide: LeaderboardService, useValue: {} },
        { provide: TiersService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /gamification/points/add', () => {
    it('should reject negative points with 400 Bad Request', async () => {
      const response = await request(app.getHttpServer()).post('/gamification/points/add').send({
        userId: '123e4567-e89b-12d3-a456-426614174000',
        points: -50,
        activityType: 'MANUAL_AWARD',
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('points must not be less than 1');
    });
  });
});
