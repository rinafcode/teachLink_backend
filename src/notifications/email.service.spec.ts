import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';

const mockEmailProvider = {
  sendMail: jest.fn(),
};

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: 'EMAIL_PROVIDER', useValue: mockEmailProvider },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should send an email', async () => {
    mockEmailProvider.sendMail.mockResolvedValue({ messageId: '123' });
    const result = await service.sendMail('test@example.com', 'Subject', 'Body');
    expect(result).toHaveProperty('messageId');
    expect(mockEmailProvider.sendMail).toHaveBeenCalled();
  });

  it('should handle email sending errors', async () => {
    mockEmailProvider.sendMail.mockRejectedValue(new Error('fail'));
    await expect(service.sendMail('fail@example.com', 'Subject', 'Body')).rejects.toThrow('fail');
  });
}); 