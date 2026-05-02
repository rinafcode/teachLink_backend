import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Queue } from 'bull';
import { getQueueToken } from '@nestjs/bull';
import { WebhookQueueService } from './webhook-queue.service';
import { WebhookRetry, WebhookStatus, WebhookProvider } from './entities/webhook-retry.entity';
describe('WebhookQueueService', () => {
    let service: WebhookQueueService;
    let repository: Repository<WebhookRetry>;
    let queue: Queue;
    const mockRepository = {
        findOne: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        find: jest.fn(),
    };
    const mockQueue = {
        add: jest.fn(),
    };
    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WebhookQueueService,
                {
                    provide: getRepositoryToken(WebhookRetry),
                    useValue: mockRepository,
                },
                {
                    provide: getQueueToken('webhooks'),
                    useValue: mockQueue,
                },
            ],
        }).compile();
        service = module.get<WebhookQueueService>(WebhookQueueService);
        repository = module.get<Repository<WebhookRetry>>(getRepositoryToken(WebhookRetry));
        queue = module.get<Queue>(getQueueToken('webhooks'));
    });
    afterEach(() => {
        jest.resetAllMocks();
    });
    describe('queueWebhook', () => {
        it('should create and queue a new webhook', async () => {
            const payload = Buffer.from('test payload');
            const webhookPayload = {
                webhookRetryId: '',
                provider: WebhookProvider.STRIPE,
                payload,
                signature: 'test-signature',
                externalEventId: 'evt_123',
            };
            const webhookRetry = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                provider: WebhookProvider.STRIPE,
                externalEventId: 'evt_123',
                status: WebhookStatus.PENDING,
                payload: webhookPayload.payload as unknown as Record<string, unknown>,
                signature: 'test-signature',
                retryCount: 0,
            };
            mockRepository.findOne.mockResolvedValue(null);
            mockRepository.create.mockReturnValue(webhookRetry);
            mockRepository.save.mockResolvedValue(webhookRetry);
            mockQueue.add.mockResolvedValue({ id: 1 });
            const result = await service.queueWebhook(webhookPayload);
            expect(result).toBe(webhookRetry.id);
            expect(mockRepository.findOne).toHaveBeenCalledWith({
                where: {
                    externalEventId: webhookPayload.externalEventId,
                    provider: webhookPayload.provider,
                },
            });
            expect(mockQueue.add).toHaveBeenCalled();
        });
        it('should update existing webhook and requeue', async () => {
            const payload = Buffer.from('test payload');
            const webhookPayload = {
                webhookRetryId: '',
                provider: WebhookProvider.STRIPE,
                payload,
                signature: 'test-signature',
                externalEventId: 'evt_123',
            };
            const existingWebhook = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                provider: WebhookProvider.STRIPE,
                externalEventId: 'evt_123',
                status: WebhookStatus.FAILED,
                retryCount: 2,
            };
            mockRepository.findOne.mockResolvedValue(existingWebhook);
            mockRepository.save.mockResolvedValue({ ...existingWebhook, status: WebhookStatus.PENDING });
            mockQueue.add.mockResolvedValue({ id: 2 });
            const result = await service.queueWebhook(webhookPayload);
            expect(result).toBe(existingWebhook.id);
            expect(mockRepository.save).toHaveBeenCalled();
        });
    });
    describe('getDeadLetterWebhooks', () => {
        it('should fetch dead letter webhooks', async () => {
            const deadLetterWebhooks = [
                {
                    id: '550e8400-e29b-41d4-a716-446655440000',
                    status: WebhookStatus.DEAD_LETTER,
                    retryCount: 3,
                },
            ];
            mockRepository.find.mockResolvedValue(deadLetterWebhooks);
            const result = await service.getDeadLetterWebhooks(100);
            expect(result).toEqual(deadLetterWebhooks);
            expect(mockRepository.find).toHaveBeenCalledWith({
                where: { status: WebhookStatus.DEAD_LETTER },
                order: { createdAt: 'DESC' },
                take: 100,
            });
        });
    });
    describe('requeueDeadLetterWebhook', () => {
        it('should requeue a dead letter webhook', async () => {
            const webhookId = '550e8400-e29b-41d4-a716-446655440000';
            const deadLetterWebhook = {
                id: webhookId,
                status: WebhookStatus.DEAD_LETTER,
                provider: WebhookProvider.STRIPE,
                externalEventId: 'evt_123',
                payload: { test: 'data' },
                retryCount: 3,
            };
            mockRepository.findOne
                .mockResolvedValueOnce(deadLetterWebhook)
                .mockResolvedValueOnce(deadLetterWebhook);
            mockRepository.save.mockResolvedValue({
                ...deadLetterWebhook,
                status: WebhookStatus.PENDING,
                retryCount: 0,
            });
            mockQueue.add.mockResolvedValue({ id: 3 });
            await service.requeueDeadLetterWebhook(webhookId);
            expect(mockRepository.save).toHaveBeenCalled();
            expect(mockQueue.add).toHaveBeenCalled();
        });
        it('should throw error if webhook not found', async () => {
            mockRepository.findOne.mockResolvedValue(null);
            await expect(service.requeueDeadLetterWebhook('non-existent')).rejects.toThrow('Webhook retry not found');
        });
        it('should throw error if webhook is not in dead letter status', async () => {
            const webhook = {
                id: '550e8400-e29b-41d4-a716-446655440000',
                status: WebhookStatus.PENDING,
            };
            mockRepository.findOne.mockResolvedValue(webhook);
            await expect(service.requeueDeadLetterWebhook(webhook.id)).rejects.toThrow('Webhook is not in dead letter status');
        });
    });
});
