import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLogService } from './audit-log.service';
import { AuditLog } from './audit-log.entity';
import { AuditAction, AuditSeverity, AuditCategory } from './enums/audit-action.enum';
import { createMockRepository, createMockConfigService, createMockQueryBuilder, } from 'test/utils/mock-factories';
import { Repository } from 'typeorm';
describe('AuditLogService', () => {
    // ─────────────────────────────────────────────────────────────────────────
    // DECLARATIONS
    // ─────────────────────────────────────────────────────────────────────────
    let service: AuditLogService;
    let mockAuditRepo: jest.Mocked<Repository<AuditLog>>;
    let mockConfigService: jest.Mocked<unknown>;
    // ─────────────────────────────────────────────────────────────────────────
    // SETUP & TEARDOWN
    // ─────────────────────────────────────────────────────────────────────────
    beforeEach(async () => {
        // Initialize dependency mocks
        mockAuditRepo = createMockRepository<AuditLog>();
        mockConfigService = createMockConfigService({
            AUDIT_LOG_RETENTION_DAYS: 365,
        });
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuditLogService,
                {
                    provide: getRepositoryToken(AuditLog),
                    useValue: mockAuditRepo,
                },
                {
                    provide: 'ConfigService',
                    useValue: mockConfigService,
                },
            ],
        }).compile();
        service = module.get<AuditLogService>(AuditLogService);
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    // ─────────────────────────────────────────────────────────────────────────
    // TEST SUITES
    // ─────────────────────────────────────────────────────────────────────────
    describe('constructor', () => {
        it('should initialize with default retention days', () => {
            const defaultService = new AuditLogService(mockAuditRepo, {
                get: jest.fn().mockReturnValue(undefined),
            } as unknown);
            expect((defaultService as unknown).retentionDays).toBe(365);
        });
        it('should use configured retention days', () => {
            expect((service as unknown).retentionDays).toBe(365);
        });
    });
    describe('log', () => {
        const auditEntry = {
            userId: 'user-1',
            userEmail: 'test@example.com',
            action: AuditAction.LOGIN,
            category: AuditCategory.AUTHENTICATION,
            severity: AuditSeverity.INFO,
            description: 'User logged in',
            ipAddress: '127.0.0.1',
            userAgent: 'TestAgent',
            metadata: { sessionId: 'session-1' },
        };
        const mockSavedLog = {
            id: 'log-1',
            ...auditEntry,
            timestamp: new Date(),
            retentionUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        };
        beforeEach(() => {
            mockAuditRepo.create.mockReturnValue(mockSavedLog as AuditLog);
            mockAuditRepo.save.mockResolvedValue(mockSavedLog as AuditLog);
        });
        it('should create and save audit log entry', async () => {
            const result = await service.log(auditEntry);
            expect(result).toEqual(mockSavedLog);
            expect(mockAuditRepo.create).toHaveBeenCalledWith({
                ...auditEntry,
                severity: AuditSeverity.INFO,
                retentionUntil: expect.any(Date),
            });
            expect(mockAuditRepo.save).toHaveBeenCalledWith(mockSavedLog);
        });
        it('should use default severity when not provided', async () => {
            const entryWithoutSeverity = { ...auditEntry };
            delete entryWithoutSeverity.severity;
            await service.log(entryWithoutSeverity);
            expect(mockAuditRepo.create).toHaveBeenCalledWith(expect.objectContaining({
                severity: AuditSeverity.INFO,
            }));
        });
        it('should handle save errors gracefully', async () => {
            const error = new Error('Database error');
            mockAuditRepo.save.mockRejectedValue(error);
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            const result = await service.log(auditEntry);
            expect(result).toEqual(mockSavedLog); // Returns created log even on error
            expect(consoleSpy).toHaveBeenCalledWith('Failed to create audit log:', error);
            consoleSpy.mockRestore();
        });
        it('should set retention date correctly', async () => {
            const retentionDays = 365;
            const expectedRetentionDate = new Date();
            expectedRetentionDate.setDate(expectedRetentionDate.getDate() + retentionDays);
            await service.log(auditEntry);
            const createCall = mockAuditRepo.create.mock.calls[0][0];
            expect(createCall.retentionUntil).toBeInstanceOf(Date);
            expect(createCall.retentionUntil.getDate()).toBe(expectedRetentionDate.getDate());
        });
    });
    describe('logAuth', () => {
        const authParams = {
            action: AuditAction.LOGIN,
            userId: 'user-1',
            userEmail: 'test@example.com',
            ipAddress: '127.0.0.1',
            userAgent: 'TestAgent',
            metadata: { sessionId: 'session-1' },
        };
        beforeEach(() => {
            mockAuditRepo.create.mockReturnValue({} as AuditLog);
            mockAuditRepo.save.mockResolvedValue({} as AuditLog);
        });
        it('should log authentication event with correct category', async () => {
            await service.logAuth(authParams.action, authParams.userId, authParams.userEmail, authParams.ipAddress, authParams.userAgent, authParams.metadata);
            expect(mockAuditRepo.create).toHaveBeenCalledWith(expect.objectContaining({
                userId: authParams.userId,
                userEmail: authParams.userEmail,
                action: authParams.action,
                category: AuditCategory.AUTHENTICATION,
                severity: AuditSeverity.INFO,
                ipAddress: authParams.ipAddress,
                userAgent: authParams.userAgent,
                metadata: authParams.metadata,
            }));
        });
        it('should handle null userId and userEmail', async () => {
            await service.logAuth(AuditAction.LOGIN_FAILED, null, null, '127.0.0.1', 'TestAgent');
            expect(mockAuditRepo.create).toHaveBeenCalledWith(expect.objectContaining({
                userId: undefined,
                userEmail: undefined,
                action: AuditAction.LOGIN_FAILED,
                category: AuditCategory.AUTHENTICATION,
            }));
        });
        it('should use provided severity', async () => {
            await service.logAuth(AuditAction.LOGIN_FAILED, 'user-1', 'test@example.com', '127.0.0.1', 'TestAgent', undefined, AuditSeverity.WARNING);
            expect(mockAuditRepo.create).toHaveBeenCalledWith(expect.objectContaining({
                severity: AuditSeverity.WARNING,
            }));
        });
    });
    describe('logDataChange', () => {
        const dataChangeParams = {
            action: AuditAction.UPDATE,
            userId: 'user-1',
            userEmail: 'test@example.com',
            entityType: 'User',
            entityId: 'user-1',
            oldValues: { name: 'Old Name' },
            newValues: { name: 'New Name' },
            ipAddress: '127.0.0.1',
            description: 'User profile updated',
        };
        beforeEach(() => {
            mockAuditRepo.create.mockReturnValue({} as AuditLog);
            mockAuditRepo.save.mockResolvedValue({} as AuditLog);
        });
        it('should log data change event with correct category', async () => {
            await service.logDataChange(dataChangeParams.action, dataChangeParams.userId, dataChangeParams.userEmail, dataChangeParams.entityType, dataChangeParams.entityId, dataChangeParams.oldValues, dataChangeParams.newValues, dataChangeParams.ipAddress, dataChangeParams.description);
            expect(mockAuditRepo.create).toHaveBeenCalledWith(expect.objectContaining({
                userId: dataChangeParams.userId,
                userEmail: dataChangeParams.userEmail,
                action: dataChangeParams.action,
                category: AuditCategory.DATA_MODIFICATION,
                severity: AuditSeverity.INFO,
                entityType: dataChangeParams.entityType,
                entityId: dataChangeParams.entityId,
                oldValues: dataChangeParams.oldValues,
                newValues: dataChangeParams.newValues,
                ipAddress: dataChangeParams.ipAddress,
                description: dataChangeParams.description,
            }));
        });
    });
    describe('logApiAccess', () => {
        const apiAccessParams = {
            userId: 'user-1',
            userEmail: 'test@example.com',
            apiEndpoint: '/api/users',
            httpMethod: 'GET',
            statusCode: 200,
            responseTimeMs: 150,
            ipAddress: '127.0.0.1',
            userAgent: 'TestAgent',
            requestId: 'req-123',
        };
        beforeEach(() => {
            mockAuditRepo.create.mockReturnValue({} as AuditLog);
            mockAuditRepo.save.mockResolvedValue({} as AuditLog);
        });
        it('should log API access with INFO severity for 2xx status', async () => {
            await service.logApiAccess(apiAccessParams.userId, apiAccessParams.userEmail, apiAccessParams.apiEndpoint, apiAccessParams.httpMethod, apiAccessParams.statusCode, apiAccessParams.responseTimeMs, apiAccessParams.ipAddress, apiAccessParams.userAgent, apiAccessParams.requestId);
            expect(mockAuditRepo.create).toHaveBeenCalledWith(expect.objectContaining({
                userId: apiAccessParams.userId,
                userEmail: apiAccessParams.userEmail,
                action: AuditAction.API_CALLED,
                category: AuditCategory.DATA_ACCESS,
                severity: AuditSeverity.INFO,
                apiEndpoint: apiAccessParams.apiEndpoint,
                httpMethod: apiAccessParams.httpMethod,
                statusCode: apiAccessParams.statusCode,
                responseTimeMs: apiAccessParams.responseTimeMs,
                ipAddress: apiAccessParams.ipAddress,
                userAgent: apiAccessParams.userAgent,
                requestId: apiAccessParams.requestId,
            }));
        });
        it('should log API access with WARNING severity for 4xx status', async () => {
            await service.logApiAccess(apiAccessParams.userId, apiAccessParams.userEmail, apiAccessParams.apiEndpoint, apiAccessParams.httpMethod, 404, apiAccessParams.responseTimeMs, apiAccessParams.ipAddress, apiAccessParams.userAgent);
            expect(mockAuditRepo.create).toHaveBeenCalledWith(expect.objectContaining({
                severity: AuditSeverity.WARNING,
                statusCode: 404,
            }));
        });
        it('should log API access with ERROR severity for 5xx status', async () => {
            await service.logApiAccess(apiAccessParams.userId, apiAccessParams.userEmail, apiAccessParams.apiEndpoint, apiAccessParams.httpMethod, 500, apiAccessParams.responseTimeMs, apiAccessParams.ipAddress, apiAccessParams.userAgent);
            expect(mockAuditRepo.create).toHaveBeenCalledWith(expect.objectContaining({
                severity: AuditSeverity.ERROR,
                statusCode: 500,
            }));
        });
        it('should handle null userId and userEmail', async () => {
            await service.logApiAccess(null, null, apiAccessParams.apiEndpoint, apiAccessParams.httpMethod, apiAccessParams.statusCode, apiAccessParams.responseTimeMs, apiAccessParams.ipAddress, apiAccessParams.userAgent);
            expect(mockAuditRepo.create).toHaveBeenCalledWith(expect.objectContaining({
                userId: undefined,
                userEmail: undefined,
            }));
        });
    });
    describe('logSecurityEvent', () => {
        const securityParams = {
            action: AuditAction.SECURITY_ALERT,
            userId: 'user-1',
            userEmail: 'test@example.com',
            ipAddress: '127.0.0.1',
            userAgent: 'TestAgent',
            description: 'Suspicious activity detected',
            metadata: { threatLevel: 'high' },
        };
        beforeEach(() => {
            mockAuditRepo.create.mockReturnValue({} as AuditLog);
            mockAuditRepo.save.mockResolvedValue({} as AuditLog);
        });
        it('should log security event with WARNING severity', async () => {
            await service.logSecurityEvent(securityParams.action, securityParams.userId, securityParams.userEmail, securityParams.ipAddress, securityParams.userAgent, securityParams.description, securityParams.metadata);
            expect(mockAuditRepo.create).toHaveBeenCalledWith(expect.objectContaining({
                userId: securityParams.userId,
                userEmail: securityParams.userEmail,
                action: securityParams.action,
                category: AuditCategory.SECURITY,
                severity: AuditSeverity.WARNING,
                ipAddress: securityParams.ipAddress,
                userAgent: securityParams.userAgent,
                description: securityParams.description,
                metadata: securityParams.metadata,
            }));
        });
    });
    describe('search', () => {
        const mockQueryBuilder = createMockQueryBuilder<AuditLog>();
        const mockLogs = [
            { id: 'log-1', action: AuditAction.LOGIN },
            { id: 'log-2', action: AuditAction.LOGOUT },
        ];
        beforeEach(() => {
            mockAuditRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder as unknown);
            mockQueryBuilder.getCount.mockResolvedValue(2);
            mockQueryBuilder.getMany.mockResolvedValue(mockLogs as AuditLog[]);
        });
        it('should search audit logs with filters', async () => {
            const filters = {
                userId: 'user-1',
                actions: [AuditAction.LOGIN],
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-01-31'),
            };
            const result = await service.search(filters, 1, 10);
            expect(result).toEqual({
                logs: mockLogs,
                total: 2,
                page: 1,
                limit: 10,
                totalPages: 1,
            });
            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('audit.userId = :userId', { userId: 'user-1' });
            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('audit.action IN (:...actions)', { actions: [AuditAction.LOGIN] });
            expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('audit.timestamp BETWEEN :startDate AND :endDate', { startDate: filters.startDate, endDate: filters.endDate });
        });
        it('should apply pagination correctly', async () => {
            await service.search({}, 2, 20);
            expect(mockQueryBuilder.skip).toHaveBeenCalledWith(20); // (page-1) * limit
            expect(mockQueryBuilder.take).toHaveBeenCalledWith(20);
        });
        it('should handle empty filters', async () => {
            await service.search({});
            expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
        });
    });
    describe('findAll', () => {
        const mockLogs = [
            { id: 'log-1', timestamp: new Date() },
            { id: 'log-2', timestamp: new Date() },
        ];
        beforeEach(() => {
            mockAuditRepo.find.mockResolvedValue(mockLogs as AuditLog[]);
        });
        it('should return all logs ordered by timestamp desc', async () => {
            const result = await service.findAll(50);
            expect(result).toEqual(mockLogs);
            expect(mockAuditRepo.find).toHaveBeenCalledWith({
                order: { timestamp: 'DESC' },
                take: 50,
            });
        });
        it('should use default limit of 100', async () => {
            await service.findAll();
            expect(mockAuditRepo.find).toHaveBeenCalledWith({
                order: { timestamp: 'DESC' },
                take: 100,
            });
        });
    });
    describe('findByUser', () => {
        const userId = 'user-1';
        const mockLogs = [{ id: 'log-1', userId }];
        beforeEach(() => {
            mockAuditRepo.find.mockResolvedValue(mockLogs as AuditLog[]);
        });
        it('should find logs by user ID', async () => {
            const result = await service.findByUser(userId, 25);
            expect(result).toEqual(mockLogs);
            expect(mockAuditRepo.find).toHaveBeenCalledWith({
                where: { userId },
                order: { timestamp: 'DESC' },
                take: 25,
            });
        });
    });
    describe('findByAction', () => {
        const action = AuditAction.LOGIN;
        const mockLogs = [{ id: 'log-1', action }];
        beforeEach(() => {
            mockAuditRepo.find.mockResolvedValue(mockLogs as AuditLog[]);
        });
        it('should find logs by action', async () => {
            const result = await service.findByAction(action, 30);
            expect(result).toEqual(mockLogs);
            expect(mockAuditRepo.find).toHaveBeenCalledWith({
                where: { action },
                order: { timestamp: 'DESC' },
                take: 30,
            });
        });
    });
    describe('findByEntity', () => {
        const entityType = 'User';
        const entityId = 'user-1';
        const mockLogs = [{ id: 'log-1', entityType, entityId }];
        beforeEach(() => {
            mockAuditRepo.find.mockResolvedValue(mockLogs as AuditLog[]);
        });
        it('should find logs by entity', async () => {
            const result = await service.findByEntity(entityType, entityId, 40);
            expect(result).toEqual(mockLogs);
            expect(mockAuditRepo.find).toHaveBeenCalledWith({
                where: { entityType, entityId },
                order: { timestamp: 'DESC' },
                take: 40,
            });
        });
    });
    describe('findByIpAddress', () => {
        const ipAddress = '127.0.0.1';
        const mockLogs = [{ id: 'log-1', ipAddress }];
        beforeEach(() => {
            mockAuditRepo.find.mockResolvedValue(mockLogs as AuditLog[]);
        });
        it('should find logs by IP address', async () => {
            const result = await service.findByIpAddress(ipAddress, 35);
            expect(result).toEqual(mockLogs);
            expect(mockAuditRepo.find).toHaveBeenCalledWith({
                where: { ipAddress },
                order: { timestamp: 'DESC' },
                take: 35,
            });
        });
    });
    describe('findByDateRange', () => {
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-01-31');
        const mockLogs = [{ id: 'log-1', timestamp: new Date('2024-01-15') }];
        beforeEach(() => {
            mockAuditRepo.find.mockResolvedValue(mockLogs as AuditLog[]);
        });
        it('should find logs by date range', async () => {
            const result = await service.findByDateRange(startDate, endDate, 1000);
            expect(result).toEqual(mockLogs);
            expect(mockAuditRepo.find).toHaveBeenCalledWith({
                where: {
                    timestamp: expect.any(Object), // Between operator
                },
                order: { timestamp: 'DESC' },
                take: 1000,
            });
        });
    });
    describe('generateReport', () => {
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-01-31');
        const mockCategoryStats = [
            { category: AuditCategory.AUTHENTICATION, count: '10' },
            { category: AuditCategory.DATA_MODIFICATION, count: '5' },
        ];
        const mockActionStats = [
            { action: AuditAction.LOGIN, count: '8' },
            { action: AuditAction.LOGOUT, count: '2' },
        ];
        const mockSeverityStats = [
            { severity: AuditSeverity.INFO, count: '12' },
            { severity: AuditSeverity.WARNING, count: '3' },
        ];
        const mockTopUsers = [
            { userId: 'user-1', userEmail: 'test@example.com', count: '5' },
        ];
        const mockTopEndpoints = [
            { endpoint: '/api/users', count: '10' },
        ];
        const mockFailedActions = [
            { action: AuditAction.API_CALLED, count: '2' },
        ];
        beforeEach(() => {
            // Mock the main query builder
            const mainQueryBuilder = createMockQueryBuilder<AuditLog>();
            mainQueryBuilder.where.mockReturnThis();
            mainQueryBuilder.getCount.mockResolvedValue(15);
            // Mock category stats query
            const categoryQueryBuilder = createMockQueryBuilder<AuditLog>();
            categoryQueryBuilder.select.mockReturnThis();
            categoryQueryBuilder.addSelect.mockReturnThis();
            categoryQueryBuilder.where.mockReturnThis();
            categoryQueryBuilder.groupBy.mockReturnThis();
            categoryQueryBuilder.getRawMany.mockResolvedValue(mockCategoryStats);
            // Mock action stats query
            const actionQueryBuilder = createMockQueryBuilder<AuditLog>();
            actionQueryBuilder.select.mockReturnThis();
            actionQueryBuilder.addSelect.mockReturnThis();
            actionQueryBuilder.where.mockReturnThis();
            actionQueryBuilder.groupBy.mockReturnThis();
            actionQueryBuilder.getRawMany.mockResolvedValue(mockActionStats);
            // Mock severity stats query
            const severityQueryBuilder = createMockQueryBuilder<AuditLog>();
            severityQueryBuilder.select.mockReturnThis();
            severityQueryBuilder.addSelect.mockReturnThis();
            severityQueryBuilder.where.mockReturnThis();
            severityQueryBuilder.groupBy.mockReturnThis();
            severityQueryBuilder.getRawMany.mockResolvedValue(mockSeverityStats);
            // Mock top users query
            const topUsersQueryBuilder = createMockQueryBuilder<AuditLog>();
            topUsersQueryBuilder.select.mockReturnThis();
            topUsersQueryBuilder.addSelect.mockReturnThis();
            topUsersQueryBuilder.where.mockReturnThis();
            topUsersQueryBuilder.andWhere.mockReturnThis();
            topUsersQueryBuilder.groupBy.mockReturnThis();
            topUsersQueryBuilder.addGroupBy.mockReturnThis();
            topUsersQueryBuilder.orderBy.mockReturnThis();
            topUsersQueryBuilder.limit.mockReturnThis();
            topUsersQueryBuilder.getRawMany.mockResolvedValue(mockTopUsers);
            // Mock top endpoints query
            const topEndpointsQueryBuilder = createMockQueryBuilder<AuditLog>();
            topEndpointsQueryBuilder.select.mockReturnThis();
            topEndpointsQueryBuilder.addSelect.mockReturnThis();
            topEndpointsQueryBuilder.where.mockReturnThis();
            topEndpointsQueryBuilder.andWhere.mockReturnThis();
            topEndpointsQueryBuilder.groupBy.mockReturnThis();
            topEndpointsQueryBuilder.orderBy.mockReturnThis();
            topEndpointsQueryBuilder.limit.mockReturnThis();
            topEndpointsQueryBuilder.getRawMany.mockResolvedValue(mockTopEndpoints);
            // Mock failed actions query
            const failedActionsQueryBuilder = createMockQueryBuilder<AuditLog>();
            failedActionsQueryBuilder.select.mockReturnThis();
            failedActionsQueryBuilder.addSelect.mockReturnThis();
            failedActionsQueryBuilder.where.mockReturnThis();
            failedActionsQueryBuilder.andWhere.mockReturnThis();
            failedActionsQueryBuilder.groupBy.mockReturnThis();
            failedActionsQueryBuilder.orderBy.mockReturnThis();
            failedActionsQueryBuilder.limit.mockReturnThis();
            failedActionsQueryBuilder.getRawMany.mockResolvedValue(mockFailedActions);
            // Set up the mock to return different query builders for different calls
            mockAuditRepo.createQueryBuilder
                .mockReturnValueOnce(mainQueryBuilder as unknown)
                .mockReturnValueOnce(categoryQueryBuilder as unknown)
                .mockReturnValueOnce(actionQueryBuilder as unknown)
                .mockReturnValueOnce(severityQueryBuilder as unknown)
                .mockReturnValueOnce(topUsersQueryBuilder as unknown)
                .mockReturnValueOnce(topEndpointsQueryBuilder as unknown)
                .mockReturnValueOnce(failedActionsQueryBuilder as unknown);
        });
        it('should generate comprehensive audit report', async () => {
            const result = await service.generateReport(startDate, endDate);
            expect(result).toEqual({
                period: { start: startDate, end: endDate },
                totalEvents: 15,
                eventsByCategory: {
                    [AuditCategory.AUTHENTICATION]: 10,
                    [AuditCategory.DATA_MODIFICATION]: 5,
                },
                eventsByAction: {
                    [AuditAction.LOGIN]: 8,
                    [AuditAction.LOGOUT]: 2,
                },
                eventsBySeverity: {
                    [AuditSeverity.INFO]: 12,
                    [AuditSeverity.WARNING]: 3,
                },
                topUsers: [
                    {
                        userId: 'user-1',
                        userEmail: 'test@example.com',
                        count: 5,
                    },
                ],
                topEndpoints: [
                    {
                        endpoint: '/api/users',
                        count: 10,
                    },
                ],
                failedActions: [
                    {
                        action: AuditAction.API_CALLED,
                        count: 2,
                    },
                ],
            });
        });
    });
});
