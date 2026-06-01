import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationsService } from './notifications.service';
import { NotificationTemplateService } from './templates/notification-template.service';
import { PreferencesService } from './preferences/preferences.service';
import { NotificationsQueueService } from './notifications.queue';
import { NotificationType } from './entities/notification.entity';

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
      quietTimeEnd: '23:59',
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
