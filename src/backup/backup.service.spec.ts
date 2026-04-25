import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { BackupService } from './backup.service';
import { BackupRecord } from './entities/backup-record.entity';
import { BackupStatus, BackupType, Region } from './enums/backup-status.enum';
import { QUEUE_NAMES, JOB_NAMES } from '../common/constants/queue.constants';
import { createMockRepository, createMockConfigService, createMockQueue, } from 'test/utils/mock-factories';
import { Repository } from 'typeorm';
describe('BackupService', () => {
    // ─────────────────────────────────────────────────────────────────────────
    // DECLARATIONS
    // ─────────────────────────────────────────────────────────────────────────
    let service: BackupService;
    let mockBackupRepo: jest.Mocked<Repository<BackupRecord>>;
    let mockBackupQueue: jest.Mocked<unknown>;
    let mockConfigService: jest.Mocked<unknown>;
    let mockAlertingService: jest.Mocked<unknown>;
    let mockMetricsService: jest.Mocked<unknown>;
    let mockScheduledTaskMonitoringService: jest.Mocked<unknown>;
    // ─────────────────────────────────────────────────────────────────────────
    // SETUP & TEARDOWN
    // ─────────────────────────────────────────────────────────────────────────
    beforeEach(async () => {
        // Initialize all dependency mocks
        mockBackupRepo = createMockRepository<BackupRecord>();
        mockBackupQueue = createMockQueue();
        mockConfigService = createMockConfigService({
            BACKUP_RETENTION_DAYS: 30,
            BACKUP_SCHEDULED_TASK_RETRY_LIMIT: 2,
            BACKUP_SCHEDULED_TASK_RETRY_DELAY_MS: 10000,
            BACKUP_SCHEDULED_TASK_TIMEOUT_MS: 30 * 60 * 1000,
            BACKUP_PRIMARY_REGION: Region.US_EAST_1,
            DB_DATABASE: 'teachlink',
        });
        mockAlertingService = {
            sendAlert: jest.fn(),
        };
        mockMetricsService = {
            recordMetric: jest.fn(),
        };
        mockScheduledTaskMonitoringService = {
            registerTask: jest.fn(),
            startExecution: jest.fn().mockReturnValue('execution-1'),
            markSuccess: jest.fn(),
            markFailure: jest.fn(),
            recordRetry: jest.fn(),
        };
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BackupService,
                {
                    provide: getRepositoryToken(BackupRecord),
                    useValue: mockBackupRepo,
                },
                {
                    provide: getQueueToken(QUEUE_NAMES.BACKUP_PROCESSING),
                    useValue: mockBackupQueue,
                },
                {
                    provide: 'ConfigService',
                    useValue: mockConfigService,
                },
                {
                    provide: 'AlertingService',
                    useValue: mockAlertingService,
                },
                {
                    provide: 'MetricsCollectionService',
                    useValue: mockMetricsService,
                },
                {
                    provide: 'ScheduledTaskMonitoringService',
                    useValue: mockScheduledTaskMonitoringService,
                },
            ],
        }).compile();
        service = module.get<BackupService>(BackupService);
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    // ─────────────────────────────────────────────────────────────────────────
    // TEST SUITES
    // ─────────────────────────────────────────────────────────────────────────
    describe('constructor', () => {
        it('should initialize with default configuration values', () => {
            const defaultConfigService = createMockConfigService({});
            const defaultService = new (BackupService as unknown)(mockBackupRepo, mockBackupQueue, defaultConfigService, mockAlertingService, mockMetricsService, mockScheduledTaskMonitoringService);
            expect((defaultService as unknown).retentionDays).toBe(30);
            expect((defaultService as unknown).scheduledTaskRetryLimit).toBe(2);
            expect((defaultService as unknown).scheduledTaskRetryDelayMs).toBe(10000);
            expect((defaultService as unknown).scheduledTaskTimeoutMs).toBe(30 * 60 * 1000);
        });
        it('should register scheduled tasks', () => {
            expect(mockScheduledTaskMonitoringService.registerTask).toHaveBeenCalledWith('weekly-database-backup', {
                expectedIntervalMs: 7 * 24 * 60 * 60 * 1000,
                timeoutMs: 30 * 60 * 1000,
                maxRetries: 2,
            });
            expect(mockScheduledTaskMonitoringService.registerTask).toHaveBeenCalledWith('cleanup-expired-backups', {
                expectedIntervalMs: 24 * 60 * 60 * 1000,
                timeoutMs: 30 * 60 * 1000,
                maxRetries: 2,
            });
        });
    });
    describe('handleScheduledBackup', () => {
        const mockBackupRecord = {
            id: 'backup-1',
            backupType: BackupType.FULL,
            status: BackupStatus.PENDING,
            region: Region.US_EAST_1,
            databaseName: 'teachlink',
            storageKey: '',
            expiresAt: new Date(),
            metadata: { startTime: new Date() },
        };
        beforeEach(() => {
            mockScheduledTaskMonitoringService.startExecution.mockReturnValue('execution-1');
            mockBackupRepo.create.mockReturnValue(mockBackupRecord as BackupRecord);
            mockBackupRepo.save.mockResolvedValue(mockBackupRecord as BackupRecord);
            mockBackupQueue.add.mockResolvedValue({} as unknown);
            mockScheduledTaskMonitoringService.markSuccess.mockResolvedValue();
        });
        it('should create and queue a scheduled backup', async () => {
            await service.handleScheduledBackup();
            expect(mockScheduledTaskMonitoringService.startExecution).toHaveBeenCalledWith('weekly-database-backup', {
                expectedIntervalMs: 7 * 24 * 60 * 60 * 1000,
                timeoutMs: 30 * 60 * 1000,
                maxRetries: 2,
            }, { source: 'BackupService' });
            expect(mockBackupRepo.create).toHaveBeenCalledWith(expect.objectContaining({
                backupType: BackupType.FULL,
                status: BackupStatus.PENDING,
                region: Region.US_EAST_1,
                databaseName: 'teachlink',
                storageKey: '',
                metadata: expect.objectContaining({
                    startTime: expect.any(Date),
                }),
            }));
            expect(mockBackupQueue.add).toHaveBeenCalledWith(JOB_NAMES.CREATE_BACKUP, {
                backupRecordId: 'backup-1',
                backupType: BackupType.FULL,
                region: Region.US_EAST_1,
                databaseName: 'teachlink',
            }, {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 10000,
                },
                timeout: 3600000,
            });
            expect(mockScheduledTaskMonitoringService.markSuccess).toHaveBeenCalledWith('execution-1', {
                attempt: 1,
                maxAttempts: 3,
                retriesUsed: 0,
            });
        });
        it('should handle backup creation failure and retry', async () => {
            mockBackupRepo.save.mockRejectedValueOnce(new Error('Database error'));
            mockBackupRepo.save.mockResolvedValueOnce(mockBackupRecord as BackupRecord);
            await service.handleScheduledBackup();
            expect(mockScheduledTaskMonitoringService.recordRetry).toHaveBeenCalledWith('weekly-database-backup', 1, 2, 'Database error');
            expect(mockScheduledTaskMonitoringService.markSuccess).toHaveBeenCalledWith('execution-1', {
                attempt: 2,
                maxAttempts: 3,
                retriesUsed: 1,
            });
        });
        it('should handle complete failure after retries', async () => {
            const error = new Error('Persistent error');
            mockBackupRepo.save.mockRejectedValue(error);
            await service.handleScheduledBackup();
            expect(mockScheduledTaskMonitoringService.markFailure).toHaveBeenCalledWith('execution-1', 'Persistent error', {
                attempt: 3,
                maxAttempts: 3,
                retriesUsed: 2,
            });
            expect(mockAlertingService.sendAlert).toHaveBeenCalledWith('BACKUP_SCHEDULED_FAILED', 'Scheduled task weekly-database-backup failed after 3 attempt(s): Persistent error', 'CRITICAL');
        });
    });
    describe('handleBackupCleanup', () => {
        const mockExpiredBackups = [
            { id: 'backup-1', createdAt: new Date('2024-01-01') },
            { id: 'backup-2', createdAt: new Date('2024-01-02') },
        ];
        beforeEach(() => {
            mockScheduledTaskMonitoringService.startExecution.mockReturnValue('execution-1');
            mockBackupRepo.find.mockResolvedValue(mockExpiredBackups as BackupRecord[]);
            mockBackupQueue.add.mockResolvedValue({} as unknown);
            mockScheduledTaskMonitoringService.markSuccess.mockResolvedValue();
        });
        it('should find and queue deletion of expired backups', async () => {
            await service.handleBackupCleanup();
            expect(mockBackupRepo.find).toHaveBeenCalledWith({
                where: {
                    createdAt: expect.any(Object), // LessThan operator
                    status: BackupStatus.COMPLETED,
                },
            });
            expect(mockBackupQueue.add).toHaveBeenCalledTimes(2);
            expect(mockBackupQueue.add).toHaveBeenCalledWith(JOB_NAMES.DELETE_BACKUP, { backupRecordId: 'backup-1' }, {
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 },
            });
            expect(mockBackupQueue.add).toHaveBeenCalledWith(JOB_NAMES.DELETE_BACKUP, { backupRecordId: 'backup-2' }, {
                attempts: 3,
                backoff: { type: 'exponential', delay: 5000 },
            });
            expect(mockScheduledTaskMonitoringService.markSuccess).toHaveBeenCalledWith('execution-1', {
                attempt: 1,
                maxAttempts: 3,
                retriesUsed: 0,
            });
        });
        it('should handle cleanup failure and retry', async () => {
            mockBackupRepo.find.mockRejectedValueOnce(new Error('Query error'));
            mockBackupRepo.find.mockResolvedValueOnce([]);
            await service.handleBackupCleanup();
            expect(mockScheduledTaskMonitoringService.recordRetry).toHaveBeenCalledWith('cleanup-expired-backups', 1, 2, 'Query error');
        });
    });
    describe('getLatestBackup', () => {
        const mockBackup = {
            id: 'backup-1',
            status: BackupStatus.COMPLETED,
            integrityVerified: true,
            completedAt: new Date('2024-01-15'),
        };
        beforeEach(() => {
            mockBackupRepo.findOne.mockResolvedValue(mockBackup as BackupRecord);
        });
        it('should return latest completed and verified backup', async () => {
            const result = await service.getLatestBackup();
            expect(result).toEqual(mockBackup);
            expect(mockBackupRepo.findOne).toHaveBeenCalledWith({
                where: {
                    status: BackupStatus.COMPLETED,
                    integrityVerified: true,
                },
                order: { completedAt: 'DESC' },
            });
        });
        it('should filter by region when specified', async () => {
            await service.getLatestBackup(Region.EU_WEST_1);
            expect(mockBackupRepo.findOne).toHaveBeenCalledWith({
                where: {
                    status: BackupStatus.COMPLETED,
                    integrityVerified: true,
                    region: Region.EU_WEST_1,
                },
                order: { completedAt: 'DESC' },
            });
        });
        it('should return null when no backup found', async () => {
            mockBackupRepo.findOne.mockResolvedValue(null);
            const result = await service.getLatestBackup();
            expect(result).toBeNull();
        });
    });
    describe('updateBackupStatus', () => {
        const backupId = 'backup-1';
        const updates = { errorMessage: 'Test error' };
        beforeEach(() => {
            mockBackupRepo.update.mockResolvedValue({ affected: 1, raw: {}, generatedMaps: [] });
        });
        it('should update backup status to completed and send success alert', async () => {
            await service.updateBackupStatus(backupId, BackupStatus.COMPLETED, updates);
            expect(mockBackupRepo.update).toHaveBeenCalledWith(backupId, {
                status: BackupStatus.COMPLETED,
                ...updates,
                updatedAt: expect.any(Date),
            });
            expect(mockAlertingService.sendAlert).toHaveBeenCalledWith('BACKUP_COMPLETED', `Backup ${backupId} completed successfully`, 'INFO');
        });
        it('should update backup status to failed and send critical alert', async () => {
            await service.updateBackupStatus(backupId, BackupStatus.FAILED, updates);
            expect(mockAlertingService.sendAlert).toHaveBeenCalledWith('BACKUP_FAILED', `Backup ${backupId} failed: Test error`, 'CRITICAL');
        });
        it('should update status without sending alert for other statuses', async () => {
            await service.updateBackupStatus(backupId, BackupStatus.IN_PROGRESS);
            expect(mockAlertingService.sendAlert).not.toHaveBeenCalled();
        });
    });
    describe('toResponseDto', () => {
        const mockBackup = {
            id: 'backup-1',
            backupType: BackupType.FULL,
            status: BackupStatus.COMPLETED,
            region: Region.US_EAST_1,
            databaseName: 'teachlink',
            backupSizeBytes: 1024000,
            integrityVerified: true,
            completedAt: new Date('2024-01-15T10:00:00Z'),
            expiresAt: new Date('2024-02-15T10:00:00Z'),
            createdAt: new Date('2024-01-15T09:00:00Z'),
            metadata: { version: '1.0' },
            storageKey: 'backup-key',
            updatedAt: new Date(),
        };
        it('should convert backup record to response DTO', () => {
            const result = service.toResponseDto(mockBackup as BackupRecord);
            expect(result).toEqual({
                id: 'backup-1',
                backupType: BackupType.FULL,
                status: BackupStatus.COMPLETED,
                region: Region.US_EAST_1,
                databaseName: 'teachlink',
                backupSizeBytes: 1024000,
                integrityVerified: true,
                completedAt: new Date('2024-01-15T10:00:00Z'),
                expiresAt: new Date('2024-02-15T10:00:00Z'),
                createdAt: new Date('2024-01-15T09:00:00Z'),
                metadata: { version: '1.0' },
            });
        });
    });
    describe('private methods', () => {
        describe('executeMonitoredScheduledTask', () => {
            const taskConfig = {
                expectedIntervalMs: 24 * 60 * 60 * 1000,
                timeoutMs: 30 * 60 * 1000,
                maxRetries: 2,
            };
            it('should execute task successfully on first attempt', async () => {
                const taskRunner = jest.fn().mockResolvedValue(undefined);
                await (service as unknown).executeMonitoredScheduledTask('test-task', taskConfig, taskRunner);
                expect(taskRunner).toHaveBeenCalledTimes(1);
                expect(mockScheduledTaskMonitoringService.markSuccess).toHaveBeenCalledWith('execution-1', {
                    attempt: 1,
                    maxAttempts: 3,
                    retriesUsed: 0,
                });
            });
            it('should retry on failure and succeed', async () => {
                const taskRunner = jest
                    .fn()
                    .mockRejectedValueOnce(new Error('First attempt failed'))
                    .mockResolvedValueOnce(undefined);
                await (service as unknown).executeMonitoredScheduledTask('test-task', taskConfig, taskRunner);
                expect(taskRunner).toHaveBeenCalledTimes(2);
                expect(mockScheduledTaskMonitoringService.recordRetry).toHaveBeenCalledWith('test-task', 1, 2, 'First attempt failed');
                expect(mockScheduledTaskMonitoringService.markSuccess).toHaveBeenCalledWith('execution-1', {
                    attempt: 2,
                    maxAttempts: 3,
                    retriesUsed: 1,
                });
            });
            it('should fail after all retries exhausted', async () => {
                const error = new Error('Persistent failure');
                const taskRunner = jest.fn().mockRejectedValue(error);
                await (service as unknown).executeMonitoredScheduledTask('test-task', taskConfig, taskRunner);
                expect(taskRunner).toHaveBeenCalledTimes(3);
                expect(mockScheduledTaskMonitoringService.markFailure).toHaveBeenCalledWith('execution-1', 'Persistent failure', {
                    attempt: 3,
                    maxAttempts: 3,
                    retriesUsed: 2,
                });
                expect(mockAlertingService.sendAlert).toHaveBeenCalledWith('BACKUP_SCHEDULED_FAILED', 'Scheduled task test-task failed after 3 attempt(s): Persistent failure', 'CRITICAL');
            });
        });
        describe('delay', () => {
            it('should delay execution for specified milliseconds', async () => {
                const startTime = Date.now();
                await (service as unknown).delay(100);
                const endTime = Date.now();
                expect(endTime - startTime).toBeGreaterThanOrEqual(95); // Allow some tolerance
            });
        });
    });
});
