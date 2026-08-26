import { NotificationsService } from './notifications.service';
import { NotificationType } from './entities/notification.entity';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockRepository: any;

  beforeEach(() => {
    mockRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((dto) => dto),
      save: jest.fn(async (data) => ({ id: 'notif-1', ...data })),
    };

    service = new NotificationsService(
      mockRepository,
      {} as any,
      {} as any,
      {
        transaction: jest.fn((cb: any) => cb({ getRepository: () => mockRepository })),
      } as any,
    );
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
});
