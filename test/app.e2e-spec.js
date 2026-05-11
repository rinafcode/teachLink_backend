"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const app_module_1 = require("../src/app.module");
const test_database_service_1 = require("./utils/test-database.service");
const test_http_client_1 = require("./utils/test-http-client");
const test_retry_helper_1 = require("./utils/test-retry-helper");
describe('App (e2e)', () => {
    let app;
    let testDb;
    let httpClient;
    let retryHelper;
    beforeAll(async () => {
        testDb = new test_database_service_1.TestDatabaseService();
        await testDb.setup();
        const moduleFixture = await testing_1.Test.createTestingModule({
            imports: [app_module_1.AppModule],
        })
            .overrideProvider('DATABASE_CONNECTION')
            .useValue(testDb.getConnection())
            .compile();
        app = moduleFixture.createNestApplication();
        app.setGlobalPrefix('api');
        await app.init();
        httpClient = new test_http_client_1.TestHttpClient(app.getHttpServer());
        retryHelper = new test_retry_helper_1.TestRetryHelper();
    }, 60000);
    afterAll(async () => {
        await app.close();
        await testDb.teardown();
    }, 30000);
    beforeEach(async () => {
        await testDb.clean();
    });
    describe('Health Check', () => {
        it('should return healthy status with retries', async () => {
            await retryHelper.withRetry(async () => {
                const response = await httpClient.get('/health');
                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('status', 'ok');
            }, {
                maxAttempts: 3,
                delayMs: 1000,
                backoffMultiplier: 2,
            });
        }, 10000);
        it('should handle database connectivity', async () => {
            await retryHelper.withRetry(async () => {
                const response = await httpClient.get('/api/health/database');
                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('database', 'connected');
            }, {
                maxAttempts: 5,
                delayMs: 500,
            });
        }, 15000);
    });
    describe('API Endpoints', () => {
        it('should handle concurrent requests stably', async () => {
            const requests = Array(10)
                .fill(null)
                .map(() => retryHelper.withRetry(() => httpClient.get('/'), { maxAttempts: 3, delayMs: 200 }));
            const results = await Promise.all(requests);
            results.forEach((response) => {
                expect(response.status).toBe(200);
            });
        }, 30000);
        it('should handle request timeouts gracefully', async () => {
            await retryHelper.withRetry(async () => {
                const response = await httpClient.get('/api/slow-endpoint', {
                    timeout: 5000,
                });
                expect([200, 404]).toContain(response.status);
            }, {
                maxAttempts: 2,
                delayMs: 1000,
            });
        }, 10000);
    });
});
//# sourceMappingURL=app.e2e-spec.js.map