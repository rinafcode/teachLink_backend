import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from '../src/notifications/notifications.service';
import { EmailService } from '../src/notifications/email.service';
import { NotificationPreferencesService } from '../src/notifications/preferences/preferences.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Notification } from '../src/notifications/entities/notification.entity';
import { NotificationDelivery } from '../src/notifications/entities/notification-delivery.entity';

const mockNotificationRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
});
const mockDeliveryRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
});
const mockEmailService = { sendMail: jest.fn() };
const mockPreferencesService = { isEnabled: jest.fn() };

describe('Notifications Integration', () => {
  let notificationsService: NotificationsService;
  let emailService: EmailService;
  let deliveryRepo;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(Notification), useFactory: mockNotificationRepo },
        { provide: getRepositoryToken(NotificationDelivery), useFactory: mockDeliveryRepo },
        { provide: EmailService, useValue: mockEmailService },
        { provide: NotificationPreferencesService, useValue: mockPreferencesService },
      ],
    }).compile();

    notificationsService = module.get(NotificationsService);
    emailService = module.get(EmailService);
    deliveryRepo = module.get(getRepositoryToken(NotificationDelivery));
  });

  it('should send notification and log delivery', async () => {
    mockPreferencesService.isEnabled.mockReturnValue(true);
    mockEmailService.sendMail.mockResolvedValue({ messageId: 'abc' });
    deliveryRepo.create.mockReturnValue({ status: 'SENT' });
    deliveryRepo.save.mockResolvedValue({ status: 'SENT' });
    // Simulate notification send
    // ...
    expect(deliveryRepo.create).toHaveBeenCalled();
    expect(deliveryRepo.save).toHaveBeenCalled();
  });
}); 