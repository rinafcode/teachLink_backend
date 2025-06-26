import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { NotificationPreferencesService } from './preferences/preferences.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { Repository } from 'typeorm';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let repo: jest.Mocked<Repository<Notification>>;
  let prefs: jest.Mocked<NotificationPreferencesService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: NotificationPreferencesService,
          useValue: {
            isEnabled: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    repo = module.get(getRepositoryToken(Notification));
    prefs = module.get(NotificationPreferencesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a notification if preference is enabled', async () => {
    prefs.isEnabled.mockReturnValue(true);
    repo.create.mockReturnValue({ userId: '1', type: NotificationType.GENERAL, content: 'Test' } as any);
    repo.save.mockResolvedValue({ id: 'n1', userId: '1', type: NotificationType.GENERAL, content: 'Test' } as any);
    const result = await service.createNotification('1', NotificationType.GENERAL, 'Test');
    expect(result).toHaveProperty('id');
    expect(repo.create).toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalled();
  });

  it('should not create a notification if preference is disabled', async () => {
    prefs.isEnabled.mockReturnValue(false);
    const result = await service.createNotification('1', NotificationType.GENERAL, 'Test');
    expect(result).toBeNull();
    expect(repo.create).not.toHaveBeenCalled();
  });
}); 