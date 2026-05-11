"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestHttpClient = void 0;
const supertest_1 = __importDefault(require("supertest"));
class TestHttpClient {
    constructor(server) {
        this.defaultTimeout = 10000;
        this.defaultRetries = 2;
        this.defaultRetryDelay = 500;
        this.server = server;
    }
    async get(path, options = {}) {
        const { timeout = this.defaultTimeout, retries = this.defaultRetries, retryDelay = this.defaultRetryDelay, headers, auth, } = options;
        return this.withRetry(() => this.makeRequest('get', path, undefined, { headers, auth }), {
            maxAttempts: retries + 1,
            delayMs: retryDelay,
            timeout,
        });
    }
    async post(path, data, options = {}) {
        const { timeout = this.defaultTimeout, retries = this.defaultRetries, retryDelay = this.defaultRetryDelay, headers, auth, } = options;
        return this.withRetry(() => this.makeRequest('post', path, data, { headers, auth }), {
            maxAttempts: retries + 1,
            delayMs: retryDelay,
            timeout,
        });
    }
    async put(path, data, options = {}) {
        const { timeout = this.defaultTimeout, retries = this.defaultRetries, retryDelay = this.defaultRetryDelay, headers, auth, } = options;
        return this.withRetry(() => this.makeRequest('put', path, data, { headers, auth }), {
            maxAttempts: retries + 1,
            delayMs: retryDelay,
            timeout,
        });
    }
    async delete(path, options = {}) {
        const { timeout = this.defaultTimeout, retries = this.defaultRetries, retryDelay = this.defaultRetryDelay, headers, auth, } = options;
        return this.withRetry(() => this.makeRequest('delete', path, undefined, { headers, auth }), {
            maxAttempts: retries + 1,
            delayMs: retryDelay,
            timeout,
        });
    }
    async patch(path, data, options = {}) {
        const { timeout = this.defaultTimeout, retries = this.defaultRetries, retryDelay = this.defaultRetryDelay, headers, auth, } = options;
        return this.withRetry(() => this.makeRequest('patch', path, data, { headers, auth }), {
            maxAttempts: retries + 1,
            delayMs: retryDelay,
            timeout,
        });
    }
    async makeRequest(method, path, data, options = {}) {
        let req = (0, supertest_1.default)(this.server)[method](path);
        if (options.headers) {
            Object.entries(options.headers).forEach(([key, value]) => {
                req = req.set(key, value);
            });
        }
        if (options.auth?.token) {
            req = req.set('Authorization', `Bearer ${options.auth.token}`);
        }
        else if (options.auth?.username && options.auth?.password) {
            req = req.auth(options.auth.username, options.auth.password);
        }
        if (data && method !== 'get' && method !== 'delete') {
            req = req.send(data);
        }
        const response = await req;
        return response;
    }
    async withRetry(operation, options) {
        const { maxAttempts, delayMs, timeout } = options;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                if (timeout) {
                    return await Promise.race([
                        operation(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout)),
                    ]);
                }
                return await operation();
            }
            catch (error) {
                const isLastAttempt = attempt === maxAttempts;
                const isRetryableError = this.isRetryableError(error);
                if (isLastAttempt || !isRetryableError) {
                    throw error;
                }
                await this.delay(delayMs * attempt);
            }
        }
        throw new Error('Max retry attempts exceeded');
    }
    isRetryableError(error) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
            return true;
        }
        if (error.status && error.status >= 500 && error.status < 600) {
            return true;
        }
        if (error.status && error.status >= 400 && error.status < 500) {
            return false;
        }
        if (error.message && error.message.includes('timeout')) {
            return true;
        }
        return false;
    }
    async delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    async waitForEndpoint(path, expectedStatus = 200, maxWaitTime = 10000, checkInterval = 500) {
        const startTime = Date.now();
        while (Date.now() - startTime < maxWaitTime) {
            try {
                const response = await this.get(path, { timeout: checkInterval });
                if (response.status === expectedStatus) {
                    return;
                }
            }
            catch {
            }
            await this.delay(checkInterval);
        }
        throw new Error(`Endpoint ${path} did not return status ${expectedStatus} within ${maxWaitTime}ms`);
    }
    async waitForDatabase(maxWaitTime = 10000, checkInterval = 500) {
        const startTime = Date.now();
        while (Date.now() - startTime < maxWaitTime) {
            try {
                const response = await this.get('/health/database', { timeout: checkInterval });
                if (response.status === 200) {
                    return;
                }
            }
            catch {
            }
            await this.delay(checkInterval);
        }
        throw new Error(`Database not ready within ${maxWaitTime}ms`);
    }
}
exports.TestHttpClient = TestHttpClient;
//# sourceMappingURL=test-http-client.js.map