import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmailTemplateService } from './email-template.service';
import { EmailTemplate } from './email-template/email-template.entity';

const mockTemplate = {
  id: 'template-id',
  subject: 'Hello {{firstName}}! Coupon: {{coupon}}',
  body: 'Dear {{firstName}}, your coupon is {{coupon}}',
};

const mockRepository = {
  findOne: jest.fn().mockResolvedValue(mockTemplate),
  save: jest.fn(),
  update: jest.fn(),
};

describe('EmailTemplateService', () => {
  let service: EmailTemplateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailTemplateService,
        { provide: getRepositoryToken(EmailTemplate), useValue: mockRepository },
      ],
    }).compile();

    service = module.get<EmailTemplateService>(EmailTemplateService);
  });

  it('renders variables correctly', async () => {
    const result = await service.preview('template-id', {
      firstName: 'Muhammad',
    });

    expect(result.body).toContain('Muhammad');
  });

  it('returns rendered subject', async () => {
    const result = await service.preview('template-id', {
      coupon: 'SAVE20',
    });

    expect(result.subject).not.toContain('{{coupon}}');
  });
});
