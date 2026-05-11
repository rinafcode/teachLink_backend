"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestRetryHelper = void 0;
class TestRetryHelper {
    constructor() {
        this.defaultMaxAttempts = 3;
        this.defaultDelayMs = 1000;
        this.defaultBackoffMultiplier = 1.5;
    }
    async withRetry(operation, options = {}) {
        const { maxAttempts = this.defaultMaxAttempts, delayMs = this.defaultDelayMs, backoffMultiplier = this.defaultBackoffMultiplier, timeout, retryCondition = this.defaultRetryCondition, } = options;
        let lastError;
        let currentDelay = delayMs;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const result = timeout ? await this.withTimeout(operation(), timeout) : await operation();
                return result;
            }
            catch (error) {
                lastError = error;
                const shouldRetry = attempt < maxAttempts && retryCondition(error);
                if (!shouldRetry) {
                    throw error;
                }
                console.warn(`Operation failed on attempt ${attempt}/${maxAttempts}, retrying in ${currentDelay}ms:`, error.message);
                await this.delay(currentDelay);
                currentDelay = Math.floor(currentDelay * backoffMultiplier);
            }
        }
        throw lastError;
    }
    async waitFor(condition, options = {}) {
        const { conditionDescription = 'condition', ...retryOptions } = options;
        return this.withRetry(async () => {
            const result = await condition();
            if (!result) {
                throw new Error(`${conditionDescription} not met`);
            }
            return result;
        }, {
            ...retryOptions,
            retryCondition: () => true,
        });
    }
    async waitForTruthy(getter, options = {}) {
        const { conditionDescription = 'value to be truthy', ...retryOptions } = options;
        return this.waitFor(async () => {
            const value = await getter();
            return value || null;
        }, {
            ...retryOptions,
            conditionDescription,
        });
    }
    async waitForStable(getter, options = {}) {
        const { stabilityWindowMs = 1000, checkIntervalMs = 100, maxWaitTimeMs = 10000, description = 'value', } = options;
        let lastValue;
        let stableStartTime = null;
        const startTime = Date.now();
        while (Date.now() - startTime < maxWaitTimeMs) {
            const currentValue = await getter();
            if (lastValue === undefined || this.deepEqual(lastValue, currentValue)) {
                if (stableStartTime === null) {
                    stableStartTime = Date.now();
                }
                else if (Date.now() - stableStartTime >= stabilityWindowMs) {
                    return currentValue;
                }
            }
            else {
                stableStartTime = null;
            }
            lastValue = currentValue;
            await this.delay(checkIntervalMs);
        }
        throw new Error(`${description} did not stabilize within ${maxWaitTimeMs}ms`);
    }
    defaultRetryCondition(error) {
        if (error.name === 'AssertionError' || error.message?.includes('expect')) {
            return false;
        }
        if (error.status && error.status >= 400 && error.status < 500) {
            return false;
        }
        if (error.code === 'ECONNREFUSED' ||
            error.code === 'ETIMEDOUT' ||
            error.code === 'ENOTFOUND' ||
            (error.status && error.status >= 500)) {
            return true;
        }
        if (error.message && error.message.toLowerCase().includes('timeout')) {
            return true;
        }
        return false;
    }
    async withTimeout(promise, timeoutMs) {
        return Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)),
        ]);
    }
    deepEqual(a, b) {
        if (a === b)
            return true;
        if (a == null || b == null)
            return a === b;
        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length)
                return false;
            for (let i = 0; i < a.length; i++) {
                if (!this.deepEqual(a[i], b[i]))
                    return false;
            }
            return true;
        }
        if (typeof a === 'object' && typeof b === 'object') {
            const keysA = Object.keys(a);
            const keysB = Object.keys(b);
            if (keysA.length !== keysB.length)
                return false;
            for (const key of keysA) {
                if (!keysB.includes(key))
                    return false;
                if (!this.deepEqual(a[key], b[key]))
                    return false;
            }
            return true;
        }
        return false;
    }
    async delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    async retryOnFailure(operation, options = {}) {
        return this.withRetry(operation, {
            ...options,
            retryCondition: () => true,
        });
    }
    async retryOnSpecificError(operation, errorCondition, options = {}) {
        return this.withRetry(operation, {
            ...options,
            retryCondition: errorCondition,
        });
    }
    async retryOnTimeout(operation, options = {}) {
        return this.withRetry(operation, {
            ...options,
            retryCondition: (error) => error.message?.toLowerCase().includes('timeout') || error.code === 'ETIMEDOUT',
        });
    }
}
exports.TestRetryHelper = TestRetryHelper;
//# sourceMappingURL=test-retry-helper.js.map