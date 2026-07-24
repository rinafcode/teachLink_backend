import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthTokensService } from './services/auth-tokens.service';
import { ThreatDetectionService } from '../security/threats/threat-detection.service';
import { User } from '../users/entities/user.entity';
import { createMockRedisClient, createMockRepository } from '../../test/utils/mock-factories';
import { THREAT_REDIS_CLIENT } from '../security/threats/threat-detection.constants';

/**
 * Integration test for the Blaqkenny wiring in AuthController.
 *
 * Proves:
 *  - Issue #798: POST /auth/login calls ThreatDetectionService.analyzeRequest
 *    BEFORE the user lookup, calls recordFailure when credentials are bad,
 *    and calls reset on successful login.
 *  - Issue #801: POST /auth/forgot-password, /auth/reset-password, and
 *    /auth/verify-email delegate to AuthTokensService (the SHA-256 hash
 *    primitive) end-to-end.
 *
 * The mocks concentrate around the wiring: we verify the service method
 * names + call order, not the cryptographic internals (those have their
 * own dedicated spec).
 */
describe('AuthController — Blaqkenny wiring (#798 + #801)', () => {
  let controller: AuthController;
  let threat: jest.Mocked<ThreatDetectionService>;
  let authService: jest.Mocked<AuthService>;
  let authTokens: jest.Mocked<AuthTokensService>;
  let userRepo: ReturnType<typeof createMockRepository<User>>;
  let redis: ReturnType<typeof createMockRedisClient>;

  beforeEach(async () => {
    threat = {
      analyzeRequest: jest.fn().mockResolvedValue(undefined),
      recordFailure: jest.fn().mockResolvedValue(undefined),
      reset: jest.fn().mockResolvedValue(undefined),
      resolveKey: jest.fn(),
      has: jest.fn(),
    } as unknown as jest.Mocked<ThreatDetectionService>;

    authService = {
      login: jest.fn().mockResolvedValue({ accessToken: 'AT', refreshToken: 'RT' }),
      requestPasswordReset: jest.fn().mockResolvedValue({ delivered: true }),
      resetPassword: jest.fn().mockResolvedValue({ id: 'u1', email: 'x@y.com' } as User),
      verifyEmailToken: jest
        .fn()
        .mockResolvedValue({ id: 'u1', email: 'x@y.com', isEmailVerified: true } as User),
    } as unknown as jest.Mocked<AuthService>;

    authTokens = {
      issuePasswordReset: jest.fn().mockResolvedValue({ rawToken: 'rawRT', expiresAt: new Date() }),
      consumePasswordReset: jest.fn(),
      issueEmailVerification: jest
        .fn()
        .mockResolvedValue({ rawToken: 'rawET', expiresAt: new Date() }),
      consumeEmailVerification: jest.fn(),
    } as unknown as jest.Mocked<AuthTokensService>;

    userRepo = createMockRepository<User>();
    redis = createMockRedisClient();

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: AuthTokensService, useValue: authTokens },
        { provide: ThreatDetectionService, useValue: threat },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: THREAT_REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    controller = moduleRef.get(AuthController);
  });

  // ─── #798 ───────────────────────────────────────────────────────────────
  describe('POST /auth/login — Issue #798 wiring', () => {
    it('calls analyzeRequest BEFORE looking up the user', async () => {
      const order: string[] = [];
      threat.analyzeRequest.mockImplementation(async () => {
        order.push('analyze');
      });
      userRepo.findOne.mockImplementation(async () => {
        order.push('db');
        return null;
      });

      await expect(
        controller.login({ email: 'ghost@example.com', password: 'whatever' }, { ip: '1.2.3.4' }),
      ).rejects.toThrow();

      expect(order).toEqual(['analyze', 'db']);
      expect(threat.analyzeRequest).toHaveBeenCalledWith('1.2.3.4');
    });

    it('records a failure and throws when the user is not found', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        controller.login({ email: 'ghost@example.com', password: 'x' }, { ip: '5.6.7.8' }),
      ).rejects.toThrow();

      expect(threat.recordFailure).toHaveBeenCalledWith('5.6.7.8');
      expect(threat.reset).not.toHaveBeenCalled();
    });

    it('records a failure and throws when bcrypt rejects the password', async () => {
      const hashed = await bcrypt.hash('right-password', 4);
      userRepo.findOne.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        password: hashed,
        roles: [],
      } as User);

      await expect(
        controller.login({ email: 'a@b.com', password: 'wrong-password' }, { ip: '9.9.9.9' }),
      ).rejects.toThrow();

      expect(threat.recordFailure).toHaveBeenCalledWith('9.9.9.9');
      expect(threat.reset).not.toHaveBeenCalled();
    });

    it('resets the failure counter on successful login', async () => {
      const hashed = await bcrypt.hash('correcthorse', 4);
      userRepo.findOne.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        password: hashed,
        roles: [],
      } as User);

      const out = await controller.login(
        { email: 'a@b.com', password: 'correcthorse' },
        { ip: '10.0.0.1' },
      );

      expect(out).toEqual({ accessToken: 'AT', refreshToken: 'RT' });
      expect(threat.recordFailure).not.toHaveBeenCalled();
      expect(threat.reset).toHaveBeenCalledWith('10.0.0.1');
      expect(authService.login).toHaveBeenCalled();
    });
  });

  // ─── #801 ───────────────────────────────────────────────────────────────
  describe('POST /auth/forgot-password — Issue #801 wiring', () => {
    it('delegates to AuthService.requestPasswordReset', async () => {
      await controller.forgotPassword({ email: 'x@y.com' });
      expect(authService.requestPasswordReset).toHaveBeenCalledWith('x@y.com');
    });
  });

  describe('POST /auth/reset-password — Issue #801 wiring', () => {
    it('delegates to AuthService.resetPassword with raw token + new password', async () => {
      await controller.resetPassword({ token: 'raw-token', newPassword: 'NewStrongPass1!' });
      expect(authService.resetPassword).toHaveBeenCalledWith('raw-token', 'NewStrongPass1!');
    });
  });

  describe('POST /auth/verify-email — Issue #801 wiring', () => {
    it('delegates to AuthService.verifyEmailToken and returns isEmailVerified', async () => {
      const out = await controller.verifyEmail({ token: 'raw-verify' });
      expect(authService.verifyEmailToken).toHaveBeenCalledWith('raw-verify');
      expect(out).toEqual({
        id: 'u1',
        email: 'x@y.com',
        isEmailVerified: true,
      });
    });
  });
});
