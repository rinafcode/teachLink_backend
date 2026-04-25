import { Test } from '@nestjs/testing';
import request, { Response } from 'supertest';
import { Server } from 'http';

export interface HttpRequestOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
  auth?: {
    token?: string;
    username?: string;
    password?: string;
  };
}

export interface HttpResponse extends Response {
  body: any;
}

export class TestHttpClient {
  private server: Server;
  private defaultTimeout = 10000;
  private defaultRetries = 2;
  private defaultRetryDelay = 500;

  constructor(server: Server) {
    this.server = server;
  }

  async get(path: string, options: HttpRequestOptions = {}): Promise<HttpResponse> {
    const { timeout = this.defaultTimeout, retries = this.defaultRetries, retryDelay = this.defaultRetryDelay, headers, auth } = options;

    return this.withRetry(
      () => this.makeRequest('get', path, undefined, { headers, auth }),
      { maxAttempts: retries + 1, delayMs: retryDelay, timeout },
    );
  }

  async post(path: string, data?: any, options: HttpRequestOptions = {}): Promise<HttpResponse> {
    const { timeout = this.defaultTimeout, retries = this.defaultRetries, retryDelay = this.defaultRetryDelay, headers, auth } = options;

    return this.withRetry(
      () => this.makeRequest('post', path, data, { headers, auth }),
      { maxAttempts: retries + 1, delayMs: retryDelay, timeout },
    );
  }

  async put(path: string, data?: any, options: HttpRequestOptions = {}): Promise<HttpResponse> {
    const { timeout = this.defaultTimeout, retries = this.defaultRetries, retryDelay = this.defaultRetryDelay, headers, auth } = options;

    return this.withRetry(
      () => this.makeRequest('put', path, data, { headers, auth }),
      { maxAttempts: retries + 1, delayMs: retryDelay, timeout },
    );
  }

  async delete(path: string, options: HttpRequestOptions = {}): Promise<HttpResponse> {
    const { timeout = this.defaultTimeout, retries = this.defaultRetries, retryDelay = this.defaultRetryDelay, headers, auth } = options;

    return this.withRetry(
      () => this.makeRequest('delete', path, undefined, { headers, auth }),
      { maxAttempts: retries + 1, delayMs: retryDelay, timeout },
    );
  }

  async patch(path: string, data?: any, options: HttpRequestOptions = {}): Promise<HttpResponse> {
    const { timeout = this.defaultTimeout, retries = this.defaultRetries, retryDelay = this.defaultRetryDelay, headers, auth } = options;

    return this.withRetry(
      () => this.makeRequest('patch', path, data, { headers, auth }),
      { maxAttempts: retries + 1, delayMs: retryDelay, timeout },
    );
  }

  private async makeRequest(
    method: 'get' | 'post' | 'put' | 'delete' | 'patch',
    path: string,
    data?: any,
    options: { headers?: Record<string, string>; auth?: HttpRequestOptions['auth'] } = {},
  ): Promise<HttpResponse> {
    let req = request(this.server)[method](path);

    // Add headers
    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        req = req.set(key, value);
      });
    }

    // Add authentication
    if (options.auth?.token) {
      req = req.set('Authorization', `Bearer ${options.auth.token}`);
    } else if (options.auth?.username && options.auth?.password) {
      req = req.auth(options.auth.username, options.auth.password);
    }

    // Add data for non-GET requests
    if (data && method !== 'get' && method !== 'delete') {
      req = req.send(data);
    }

    const response = await req;
    return response as HttpResponse;
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    options: { maxAttempts: number; delayMs: number; timeout?: number },
  ): Promise<T> {
    const { maxAttempts, delayMs, timeout } = options;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (timeout) {
          return await Promise.race([
            operation(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`Request timeout after ${timeout}ms`)), timeout),
            ),
          ]);
        }
        return await operation();
      } catch (error) {
        const isLastAttempt = attempt === maxAttempts;
        const isRetryableError = this.isRetryableError(error);

        if (isLastAttempt || !isRetryableError) {
          throw error;
        }

        // Wait before retrying
        await this.delay(delayMs * attempt); // Exponential backoff
      }
    }

    throw new Error('Max retry attempts exceeded');
  }

  private isRetryableError(error: any): boolean {
    // Retry on network errors, timeouts, and 5xx server errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return true;
    }

    if (error.status && error.status >= 500 && error.status < 600) {
      return true;
    }

    // Don't retry on client errors (4xx) or specific errors
    if (error.status && error.status >= 400 && error.status < 500) {
      return false;
    }

    // Retry on timeout errors
    if (error.message && error.message.includes('timeout')) {
      return true;
    }

    return false;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Utility methods for common test scenarios
  async waitForEndpoint(
    path: string,
    expectedStatus = 200,
    maxWaitTime = 10000,
    checkInterval = 500,
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const response = await this.get(path, { timeout: checkInterval });
        if (response.status === expectedStatus) {
          return;
        }
      } catch {
        // Continue waiting
      }
      await this.delay(checkInterval);
    }

    throw new Error(`Endpoint ${path} did not return status ${expectedStatus} within ${maxWaitTime}ms`);
  }

  async waitForDatabase(maxWaitTime = 10000, checkInterval = 500): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const response = await this.get('/health/database', { timeout: checkInterval });
        if (response.status === 200) {
          return;
        }
      } catch {
        // Continue waiting
      }
      await this.delay(checkInterval);
    }

    throw new Error(`Database not ready within ${maxWaitTime}ms`);
  }
}