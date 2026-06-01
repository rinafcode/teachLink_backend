import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationsQueueService } from './notifications.queue';
import { Notification, NotificationPriority, NotificationStatus, NotificationType } from './entities/notification.entity';

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
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should deduplicate identical pending notifications within the batch window', async () => {
    const existing = { id: 'n1', userId: 'user1', title: 'New course', content: 'New content', type: NotificationType.EMAIL, status: NotificationStatus.PENDING, createdAt: new Date() };
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
    const saved = { id: 'n2', userId: 'user1', title: 'Urgent', content: 'Please respond', type: NotificationType.SMS, priority: NotificationPriority.URGENT, status: NotificationStatus.SENT, deliveryAttempts: 0, createdAt: new Date() };
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
