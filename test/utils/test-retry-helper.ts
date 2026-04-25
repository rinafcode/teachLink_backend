export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  timeout?: number;
  retryCondition?: (error: any) => boolean;
}

export class TestRetryHelper {
  private defaultMaxAttempts = 3;
  private defaultDelayMs = 1000;
  private defaultBackoffMultiplier = 1.5;

  async withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {},
  ): Promise<T> {
    const {
      maxAttempts = this.defaultMaxAttempts,
      delayMs = this.defaultDelayMs,
      backoffMultiplier = this.defaultBackoffMultiplier,
      timeout,
      retryCondition = this.defaultRetryCondition,
    } = options;

    let lastError: any;
    let currentDelay = delayMs;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = timeout
          ? await this.withTimeout(operation(), timeout)
          : await operation();

        return result;
      } catch (error) {
        lastError = error;

        const shouldRetry = attempt < maxAttempts && retryCondition(error);

        if (!shouldRetry) {
          throw error;
        }

        // Log retry attempt
        console.warn(
          `Operation failed on attempt ${attempt}/${maxAttempts}, retrying in ${currentDelay}ms:`,
          error.message,
        );

        // Wait before retrying
        await this.delay(currentDelay);

        // Increase delay for next attempt
        currentDelay = Math.floor(currentDelay * backoffMultiplier);
      }
    }

    throw lastError;
  }

  async waitFor<T>(
    condition: () => Promise<T> | T,
    options: RetryOptions & {
      conditionDescription?: string;
    } = {},
  ): Promise<T> {
    const { conditionDescription = 'condition', ...retryOptions } = options;

    return this.withRetry(
      async () => {
        const result = await condition();
        if (!result) {
          throw new Error(`${conditionDescription} not met`);
        }
        return result;
      },
      {
        ...retryOptions,
        retryCondition: () => true, // Always retry for wait conditions
      },
    );
  }

  async waitForTruthy<T>(
    getter: () => Promise<T> | T,
    options: RetryOptions & {
      conditionDescription?: string;
    } = {},
  ): Promise<T> {
    const { conditionDescription = 'value to be truthy', ...retryOptions } = options;

    return this.waitFor(
      async () => {
        const value = await getter();
        return value || null;
      },
      {
        ...retryOptions,
        conditionDescription,
      },
    );
  }

  async waitForStable<T>(
    getter: () => Promise<T> | T,
    options: {
      stabilityWindowMs?: number;
      checkIntervalMs?: number;
      maxWaitTimeMs?: number;
      description?: string;
    } = {},
  ): Promise<T> {
    const {
      stabilityWindowMs = 1000,
      checkIntervalMs = 100,
      maxWaitTimeMs = 10000,
      description = 'value',
    } = options;

    let lastValue: T;
    let stableStartTime: number | null = null;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTimeMs) {
      const currentValue = await getter();

      if (lastValue === undefined || this.deepEqual(lastValue, currentValue)) {
        if (stableStartTime === null) {
          stableStartTime = Date.now();
        } else if (Date.now() - stableStartTime >= stabilityWindowMs) {
          return currentValue;
        }
      } else {
        stableStartTime = null;
      }

      lastValue = currentValue;
      await this.delay(checkIntervalMs);
    }

    throw new Error(`${description} did not stabilize within ${maxWaitTimeMs}ms`);
  }

  private defaultRetryCondition(error: any): boolean {
    // Don't retry on assertion errors or validation errors
    if (error.name === 'AssertionError' || error.message?.includes('expect')) {
      return false;
    }

    // Don't retry on 4xx client errors
    if (error.status && error.status >= 400 && error.status < 500) {
      return false;
    }

    // Retry on network errors, timeouts, and 5xx server errors
    if (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND' ||
      (error.status && error.status >= 500)
    ) {
      return true;
    }

    // Retry on timeout messages
    if (error.message && error.message.toLowerCase().includes('timeout')) {
      return true;
    }

    return false;
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);
  }

  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true;

    if (a == null || b == null) return a === b;

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!this.deepEqual(a[i], b[i])) return false;
      }
      return true;
    }

    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);

      if (keysA.length !== keysB.length) return false;

      for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!this.deepEqual(a[key], b[key])) return false;
      }
      return true;
    }

    return false;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Utility methods for common test scenarios
  async retryOnFailure<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {},
  ): Promise<T> {
    return this.withRetry(operation, {
      ...options,
      retryCondition: () => true, // Always retry
    });
  }

  async retryOnSpecificError<T>(
    operation: () => Promise<T>,
    errorCondition: (error: any) => boolean,
    options: Omit<RetryOptions, 'retryCondition'> = {},
  ): Promise<T> {
    return this.withRetry(operation, {
      ...options,
      retryCondition: errorCondition,
    });
  }

  async retryOnTimeout<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {},
  ): Promise<T> {
    return this.withRetry(operation, {
      ...options,
      retryCondition: (error) =>
        error.message?.toLowerCase().includes('timeout') ||
        error.code === 'ETIMEDOUT',
    });
  }
}