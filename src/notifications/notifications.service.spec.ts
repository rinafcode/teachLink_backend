import { NotificationsService } from './notifications.service';
import { NotificationType, NotificationStatus } from './entities/notification.entity';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockRepository: any;

  beforeEach(() => {
    mockRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((dto) => dto),
      save: jest.fn(async (data) => ({ id: 'notif-1', ...data })),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    };

    service = new NotificationsService(mockRepository);
  });

  it('should deliver EMAIL and PUSH with same content (different types)', async () => {
    const userId = 'user-1';
    const content = 'Test message';

    const email = await service.sendNotification(userId, NotificationType.EMAIL, content);
    const push = await service.sendNotification(userId, NotificationType.PUSH, content);

    expect(email).toBeTruthy();
    expect(push).toBeTruthy();
    expect(mockRepository.findOne).toHaveBeenCalledTimes(2);
  });

  it('should paginate notifications newest-first with optional unread filter', async () => {
    const userId = 'user-1';
    mockRepository.findAndCount.mockResolvedValue([[{ id: 'n1' }], 1]);

    const result = await service.getNotifications(userId, { page: 1, limit: 10, unread: true });

    expect(mockRepository.findAndCount).toHaveBeenCalledWith({
      where: { userId, isRead: false },
      order: { createdAt: 'DESC' },
      skip: 0,
      take: 10,
    });
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('should filter notifications by delivery status', async () => {
    const userId = 'user-1';
    await service.getNotifications(userId, { status: NotificationStatus.SENT, limit: 5 });

    expect(mockRepository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId, status: NotificationStatus.SENT },
        order: { createdAt: 'DESC' },
        take: 5,
      }),
    );
  });
});
