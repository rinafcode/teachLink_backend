import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { NotificationPreferences } from '../entities/notification-preferences.entity';
import { PreferencesService } from './preferences.service';

describe('PreferencesService', () => {
  let service: PreferencesService;
  const repository = {
    findOne: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn((prefs) => Promise.resolve(prefs)),
  };

  beforeEach(async () => {
    repository.findOne.mockReset();
    repository.create.mockReset();
    repository.save.mockReset();
    repository.create.mockImplementation((dto: any) => dto);
    repository.save.mockImplementation((prefs: any) => Promise.resolve(prefs));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PreferencesService,
        {
          provide: getRepositoryToken(NotificationPreferences),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get(PreferencesService);
  });

  it('should create default preferences when none exist', async () => {
    repository.findOne.mockResolvedValueOnce(undefined);
    const prefs = await service.getPreferences('user-1');
    expect(repository.create).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }));
    expect(prefs.userId).toBe('user-1');
  });

  it('should toggle channel preferences', async () => {
    repository.findOne.mockResolvedValueOnce({
      userId: 'user-1',
      emailEnabled: true,
      pushEnabled: true,
    });
    repository.save.mockResolvedValueOnce({
      userId: 'user-1',
      emailEnabled: false,
      pushEnabled: true,
    });

    const updated = await service.toggleChannel('user-1', 'emailEnabled');
    expect(updated.emailEnabled).toBe(false);
    expect(updated.pushEnabled).toBe(true);
    expect(repository.save).toHaveBeenCalled();
  });

  // ─── Protected security-critical event types (#1160) ─────────────────────

  it('should reject disabling a protected event type via eventFrequency', async () => {
    repository.findOne.mockResolvedValueOnce({ userId: 'user-1' });

    await expect(
      service.updatePreferences('user-1', {
        eventFrequency: { login_from_new_device: 'never' },
      }),
    ).rejects.toThrow(BadRequestException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('should reject disabling a protected event type via topicSubscriptions', async () => {
    repository.findOne.mockResolvedValueOnce({ userId: 'user-1' });

    await expect(
      service.updatePreferences('user-1', {
        topicSubscriptions: { password_change: false },
      }),
    ).rejects.toThrow(BadRequestException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('should allow a protected event type to keep an enabled frequency', async () => {
    repository.findOne.mockResolvedValueOnce({ userId: 'user-1' });

    const updated = await service.updatePreferences('user-1', {
      eventFrequency: { payment_receipt: 'instant' },
    });
    expect(updated.eventFrequency).toEqual({ payment_receipt: 'instant' });
    expect(repository.save).toHaveBeenCalled();
  });

  it('should allow opting out of non-security-critical event types', async () => {
    repository.findOne.mockResolvedValueOnce({ userId: 'user-1' });

    const updated = await service.updatePreferences('user-1', {
      eventFrequency: { course_update: 'never' },
    });
    expect(updated.eventFrequency).toEqual({ course_update: 'never' });
    expect(repository.save).toHaveBeenCalled();
  });

  it('should reject unknown top-level preference keys', async () => {
    repository.findOne.mockResolvedValueOnce({ userId: 'user-1' });

    await expect(service.updatePreferences('user-1', { bogusKey: true } as any)).rejects.toThrow(
      BadRequestException,
    );
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('should reject unknown event types in eventFrequency', async () => {
    repository.findOne.mockResolvedValueOnce({ userId: 'user-1' });

    await expect(
      service.updatePreferences('user-1', {
        eventFrequency: { not_a_real_event: 'daily' },
      }),
    ).rejects.toThrow(BadRequestException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('should reject unknown event types in topicSubscriptions', async () => {
    repository.findOne.mockResolvedValueOnce({ userId: 'user-1' });

    await expect(
      service.updatePreferences('user-1', {
        topicSubscriptions: { typo_event: true },
      }),
    ).rejects.toThrow(BadRequestException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('should reject invalid frequency values', async () => {
    repository.findOne.mockResolvedValueOnce({ userId: 'user-1' });

    await expect(
      service.updatePreferences('user-1', {
        eventFrequency: { course_update: 'sometimes' },
      } as any),
    ).rejects.toThrow(BadRequestException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('should reject disabling the last remaining delivery channel', async () => {
    repository.findOne.mockResolvedValueOnce({
      userId: 'user-1',
      emailEnabled: true,
      pushEnabled: false,
      inAppEnabled: false,
      smsEnabled: false,
    });

    await expect(service.toggleChannel('user-1', 'emailEnabled')).rejects.toThrow(
      BadRequestException,
    );
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('should reject unknown channels on toggleChannel', async () => {
    repository.findOne.mockResolvedValueOnce({ userId: 'user-1' });

    await expect(service.toggleChannel('user-1', 'carrierPigeonEnabled' as any)).rejects.toThrow(
      BadRequestException,
    );
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('should reject updatePreferences that disables every channel', async () => {
    repository.findOne.mockResolvedValueOnce({
      userId: 'user-1',
      emailEnabled: true,
      pushEnabled: true,
      inAppEnabled: true,
      smsEnabled: true,
    });

    await expect(
      service.updatePreferences('user-1', {
        emailEnabled: false,
        pushEnabled: false,
        inAppEnabled: false,
        smsEnabled: false,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  // ─── unsubscribe (#1160) ──────────────────────────────────────────────────

  it('should reject unsubscribing from a security-critical event type', async () => {
    repository.findOne.mockResolvedValueOnce({ userId: 'user-1' });

    await expect(service.unsubscribe('user-1', 'login_from_new_device')).rejects.toThrow(
      BadRequestException,
    );
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('should reject unsubscribing from an unknown event type', async () => {
    repository.findOne.mockResolvedValueOnce({ userId: 'user-1' });

    await expect(service.unsubscribe('user-1', 'mystery_event')).rejects.toThrow(
      BadRequestException,
    );
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('should allow unsubscribing from non-security-critical event types', async () => {
    repository.findOne.mockResolvedValueOnce({ userId: 'user-1' });

    const updated = await service.unsubscribe('user-1', 'course_update');
    expect(updated.eventFrequency).toEqual({ course_update: 'never' });
    expect(repository.save).toHaveBeenCalled();
  });

  it('should allow global unsubscribe via the "all" event type', async () => {
    repository.findOne.mockResolvedValueOnce({ userId: 'user-1' });

    const updated = await service.unsubscribe('user-1', 'all');
    expect(updated.globalUnsubscribe).toBe(true);
    expect(repository.save).toHaveBeenCalled();
  });
});
