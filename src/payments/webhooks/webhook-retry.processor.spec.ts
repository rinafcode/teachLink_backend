import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WebhookRetryProcessor } from './webhook-retry.processor';
import { WebhookRetry, WebhookStatus, WebhookProvider } from './entities/webhook-retry.entity';
import { ProviderFactoryService } from '../providers/provider-factory.service';
import { PaymentsService } from '../payments.service';
describe('WebhookRetryProcessor', () => {
    let processor: WebhookRetryProcessor;
    let repository: Repository<WebhookRetry>;
    let providerFactory: ProviderFactoryService;
    let paymentsService: PaymentsService;
    const mockRepository = {
        findOne: jest.fn(),
        save: jest.fn(),
    };
    const mockProviderFactory = {
        getProvider: jest.fn(),
    };
    const mockPaymentsService = {
        updatePaymentStatus: jest.fn(),
        processRefundFromWebhook: jest.fn(),
        handleSubscriptionEvent: jest.fn(),
    };
    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WebhookRetryProcessor,
                {
                    provide: getRepositoryToken(WebhookRetry),
                    useValue: mockRepository,
                },
                {
                    provide: ProviderFactoryService,
                    useValue: mockProviderFactory,
                },
                {
                    provide: PaymentsService,
                    useValue: mockPaymentsService,
                },
            ],
        }).compile();
        processor = module.get<WebhookRetryProcessor>(WebhookRetryProcessor);
        repository = module.get<Repository<WebhookRetry>>(getRepositoryToken(WebhookRetry));
        providerFactory = module.get<ProviderFactoryService>(ProviderFactoryService);
        paymentsService = module.get<PaymentsService>(PaymentsService);
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    describe('processWebhook', () => {
        it('should process webhook successfully', async () => {
            const webhookRetryId = '550e8400-e29b-41d4-a716-446655440000';
            const webhookRetry = {
                id: webhookRetryId,
                status: WebhookStatus.PENDING,
                provider: WebhookProvider.STRIPE,
                payload: {},
                signature: 'test-signature',
                retryCount: 0,
                maxRetries: 3,
            };
            const mockStripeProvider = {
                handleWebhook: jest.fn().mockResolvedValue({
                    type: 'payment_intent.succeeded',
                    id: 'evt_123',
                    data: {
                        object: {
                            id: 'pi_123',
                            metadata: {},
                        },
                    },
                }),
            };
            mockRepository.findOne
                .mockResolvedValueOnce(webhookRetry)
                .mockResolvedValueOnce(webhookRetry);
            mockProviderFactory.getProvider.mockReturnValue(mockStripeProvider);
            mockPaymentsService.updatePaymentStatus.mockResolvedValue(undefined);
            mockRepository.save.mockResolvedValue({
                ...webhookRetry,
                status: WebhookStatus.SUCCEEDED,
                processedAt: new Date(),
            });
            const job = {
                data: {
                    webhookRetryId,
                    provider: WebhookProvider.STRIPE,
                    payload: Buffer.from('test'),
                    signature: 'test-signature',
                    externalEventId: 'evt_123',
                },
            } as unknown;
            await processor.processWebhook(job);
            expect(mockRepository.findOne).toHaveBeenCalled();
            expect(mockRepository.save).toHaveBeenCalled();
        });
        it('should handle webhook processing error with retry', async () => {
            const webhookRetryId = '550e8400-e29b-41d4-a716-446655440000';
            const webhookRetry = {
                id: webhookRetryId,
                status: WebhookStatus.PROCESSING,
                provider: WebhookProvider.STRIPE,
                retryCount: 0,
                maxRetries: 3,
                lastError: null,
                errorDetails: null,
                nextRetryTime: null,
            };
            const mockStripeProvider = {
                handleWebhook: jest.fn().mockRejectedValue(new Error('Signature verification failed')),
            };
            mockRepository.findOne.mockResolvedValueOnce(webhookRetry);
            mockProviderFactory.getProvider.mockReturnValue(mockStripeProvider);
            mockRepository.findOne.mockResolvedValueOnce(webhookRetry);
            mockRepository.save.mockResolvedValue({
                ...webhookRetry,
                retryCount: 1,
                lastError: 'Signature verification failed',
                status: WebhookStatus.PENDING,
            });
            const job = {
                data: {
                    webhookRetryId,
                    provider: WebhookProvider.STRIPE,
                    payload: Buffer.from('test'),
                    signature: 'test-signature',
                    externalEventId: 'evt_123',
                },
                retry: jest.fn().mockResolvedValue(undefined),
            } as unknown;
            await processor.processWebhook(job);
            expect(mockRepository.save).toHaveBeenCalled();
            expect(job.retry).toHaveBeenCalled();
        });
    });
    describe('exponential backoff calculation', () => {
        it('should calculate correct exponential backoff', async () => {
            const delays: number[] = [];
            // Access the private method through reflection for testing
            const calculateNextRetryTime = (processor as unknown).calculateNextRetryTime.bind(processor);
            for (let i = 0; i < 5; i++) {
                const delay = calculateNextRetryTime(i);
                delays.push(delay);
            }
            // Verify exponential growth (with jitter tolerance)
            expect(delays[0]).toBeLessThan(delays[1]);
            expect(delays[1]).toBeLessThan(delays[2]);
            expect(delays[2]).toBeLessThan(delays[3]);
            expect(delays[3]).toBeLessThan(delays[4]);
            // Max delay should be capped at 1 hour
            expect(delays[4]).toBeLessThanOrEqual(3600000);
        });
    });
});
