import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationsQueueService } from './notifications.queue';
import { PreferencesService } from './preferences/preferences.service';
import { NotificationTemplateService } from './templates/notification-template.service';
import {
  Notification,
  NotificationPriority,
  NotificationStatus,
  NotificationType,
} from './entities/notification.entity';

const mockRepository = {
  findOne: jest.fn(),
  create: jest.fn((dto) => dto),
  save: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
};

const mockQueue = {
  publishToTopic: jest.fn(),
};

const mockConfig = {
  get: jest.fn((key: string, defaultValue?: string) => {
    if (key === 'NOTIFICATION_BATCH_WINDOW_MS') {
      return defaultValue ?? `${5 * 60 * 1000}`;
    }
    return defaultValue ?? null;
  }),
};

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: ConfigService, useValue: mockConfig },
        { provide: getRepositoryToken(Notification), useValue: mockRepository },
        { provide: NotificationsQueueService, useValue: mockQueue },
        {
          provide: PreferencesService,
          useValue: {
            getPreferences: jest.fn().mockResolvedValue({ channels: { email: true, push: true } }),
            isChannelEnabled: jest.fn().mockResolvedValue(true),
            updatePreferences: jest.fn(),
          },
        },
        {
          provide: NotificationTemplateService,
          useValue: {
            renderByName: jest
              .fn()
              .mockResolvedValue({ subject: 'Test', body: 'Test', templateVersion: 1 }),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should deduplicate identical pending notifications within the batch window', async () => {
    const existing = {
      id: 'n1',
      userId: 'user1',
      title: 'New course',
      content: 'New content',
      type: NotificationType.EMAIL,
      status: NotificationStatus.PENDING,
      createdAt: new Date(),
    };
    mockRepository.findOne.mockResolvedValue(existing);

    const result = await service.send({
      userId: 'user1',
      title: 'New course',
      content: 'New content',
      type: NotificationType.EMAIL,
      priority: NotificationPriority.MEDIUM,
    });

    expect(result).toBe(existing);
    expect(mockRepository.save).not.toHaveBeenCalled();
  });

  it('should publish urgent notifications immediately', async () => {
    mockRepository.findOne.mockResolvedValue(null);
    const saved = {
      id: 'n2',
      userId: 'user1',
      title: 'Urgent',
      content: 'Please respond',
      type: NotificationType.SMS,
      priority: NotificationPriority.URGENT,
      status: NotificationStatus.SENT,
      deliveryAttempts: 0,
      createdAt: new Date(),
    };
    mockRepository.save.mockResolvedValue(saved);

    const result = await service.send({
      userId: 'user1',
      title: 'Urgent',
      content: 'Please respond',
      type: NotificationType.SMS,
      priority: NotificationPriority.URGENT,
    });

    expect(mockQueue.publishToTopic).toHaveBeenCalledWith(saved, { bypassBatch: true });
    expect(mockRepository.update).toHaveBeenCalledWith(saved.id, expect.any(Object));
    expect(result).toEqual(saved);
  });
});

describe('NotificationsService', () => {
  let service: NotificationsService;
  const notificationRepository = {
    create: jest.fn((dto) => dto),
    save: jest.fn(async (notification) => ({ id: 'notif-1', ...notification })),
    update: jest.fn(async () => undefined),
  };
  const preferencesService = {
    getPreferences: jest.fn(),
    isChannelEnabled: jest.fn(),
    updatePreferences: jest.fn(),
  };
  const queueService = { publishToTopic: jest.fn() };
  const templateService = { renderByName: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    preferencesService.getPreferences.mockResolvedValue({
      globalUnsubscribe: false,
      topicSubscriptions: {},
      eventFrequency: {},
      quietTimeStart: '00:00',
      quietTimeEnd: '00:01',
    });
    preferencesService.isChannelEnabled.mockResolvedValue(true);
    templateService.renderByName.mockResolvedValue({
      subject: 'Hello',
      body: 'World',
      templateVersion: 1,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: notificationRepository,
        },
        { provide: PreferencesService, useValue: preferencesService },
        { provide: NotificationsQueueService, useValue: queueService },
        { provide: NotificationTemplateService, useValue: templateService },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(null) } },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  it('should send templated notifications across enabled channels and use channel-specific templates', async () => {
    const dto = {
      userId: 'user-1',
      templateName: 'course_update',
      eventType: 'course_update',
      context: { courseName: 'Astrology', userName: 'Ada', message: 'A new lesson is live.' },
    };

    await service.sendTemplated(dto);

    expect(templateService.renderByName).toHaveBeenCalledWith(
      'course_update',
      dto.context,
      undefined,
      NotificationType.EMAIL,
    );
    expect(templateService.renderByName).toHaveBeenCalledWith(
      'course_update',
      dto.context,
      undefined,
      NotificationType.PUSH,
    );
    expect(templateService.renderByName).toHaveBeenCalledWith(
      'course_update',
      dto.context,
      undefined,
      NotificationType.IN_APP,
    );
    expect(queueService.publishToTopic).toHaveBeenCalledTimes(2);
  });

  it('should unsubscribe user from all notifications', async () => {
    await service.unsubscribe('user-1', 'all');
    expect(preferencesService.updatePreferences).toHaveBeenCalledWith('user-1', {
      globalUnsubscribe: true,
    });
  });
});
