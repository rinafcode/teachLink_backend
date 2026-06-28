import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationTemplateService } from './notification-template.service';
import { NotificationTemplate } from '../entities/notification-template.entity';
import { NotificationType } from '../entities/notification.entity';

describe('NotificationTemplateService', () => {
  let service: NotificationTemplateService;

  const mockTemplate: NotificationTemplate = {
    id: 'tpl-1',
    version: 1,
    name: 'welcome',
    templateVersion: 2,
    channel: NotificationType.EMAIL,
    subjectTemplate: 'Welcome, {{name}}!',
    bodyTemplate: '<p>Hello {{name}}, welcome to TeachLink.</p>',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationTemplateService,
        {
          provide: getRepositoryToken(NotificationTemplate),
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockTemplate),
            save: jest.fn(),
            create: jest.fn((dto) => dto),
          },
        },
      ],
    }).compile();

    service = module.get(NotificationTemplateService);
  });

  describe('render', () => {
    it('should compile subject and body with Handlebars context', () => {
      const result = service.render(mockTemplate, { name: 'Ada' });
      expect(result.subject).toBe('Welcome, Ada!');
      expect(result.body).toContain('Hello Ada');
      expect(result.templateVersion).toBe(2);
    });

    it('should render body-only templates without subject', () => {
      const inApp = { ...mockTemplate, subjectTemplate: null };
      const result = service.render(inApp, { name: 'Ada' });
      expect(result.subject).toBeUndefined();
      expect(result.body).toContain('Ada');
    });
  });

  describe('renderByName', () => {
    it('should load template by name and render', async () => {
      const result = await service.renderByName('welcome', { name: 'Bob' });
      expect(result.body).toContain('Bob');
    });

    it('should select channel-specific templates by channel', async () => {
      const channelTemplate = {
        ...mockTemplate,
        channel: NotificationType.IN_APP,
        subjectTemplate: null,
      };
      (service as any).templateRepository = {
        findOne: jest.fn().mockResolvedValue(channelTemplate),
      } as any;

      const result = await service.renderByName(
        'welcome',
        { name: 'Bob' },
        undefined,
        NotificationType.IN_APP,
      );
      expect(result.body).toContain('Bob');
      expect(result.subject).toBeUndefined();
    });
  });
});
