import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bull';
import { EmailService } from './email.service';
describe('EmailService', () => {
    let service: EmailService;
    let mockQueue: unknown;
    beforeEach(async () => {
        mockQueue = {
            add: jest.fn().mockResolvedValue({}),
        };
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EmailService,
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn((key: string) => {
                            const config = {
                                SMTP_HOST: 'smtp.test.com',
                                SMTP_PORT: 587,
                                SMTP_SECURE: false,
                                SMTP_USER: 'test@test.com',
                                SMTP_PASS: 'password',
                                EMAIL_FROM: 'noreply@teachlink.io',
                                EMAIL_FROM_NAME: 'TeachLink',
                                APP_URL: 'http://localhost:3000',
                            };
                            return config[key];
                        }),
                    },
                },
                {
                    provide: getQueueToken('email'),
                    useValue: mockQueue,
                },
            ],
        }).compile();
        service = module.get<EmailService>(EmailService);
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
    describe('sendVerificationEmail', () => {
        it('should queue verification email', async () => {
            const email = 'test@example.com';
            const token = 'test-token-123';
            await service.sendVerificationEmail(email, token);
            expect(mockQueue.add).toHaveBeenCalledWith('send-email', expect.objectContaining({
                to: email,
                subject: 'Verify Your Email - TeachLink',
                template: 'verification',
                context: expect.objectContaining({
                    verificationUrl: expect.stringContaining(token),
                }),
            }), expect.any(Object));
        });
    });
    describe('sendPasswordResetEmail', () => {
        it('should queue password reset email', async () => {
            const email = 'test@example.com';
            const token = 'reset-token-456';
            await service.sendPasswordResetEmail(email, token);
            expect(mockQueue.add).toHaveBeenCalledWith('send-email', expect.objectContaining({
                to: email,
                subject: 'Reset Your Password - TeachLink',
                template: 'reset-password',
                context: expect.objectContaining({
                    resetUrl: expect.stringContaining(token),
                }),
            }), expect.any(Object));
        });
    });
});
