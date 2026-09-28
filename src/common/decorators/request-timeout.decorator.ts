import { SetMetadata } from '@nestjs/common';

export const REQUEST_TIMEOUT_METADATA = 'request-timeout:config';

export interface RequestTimeoutConfig {
  timeout?: number; // Timeout in milliseconds
}

/**
 * Decorator to configure request timeout for a specific endpoint
 * @param timeoutMs Timeout in milliseconds (optional, uses default if not provided)
 * @example
 * @UseRequestTimeout(5000) // 5 seconds
 * @Get(':id')
 * getData(@Param('id') id: string) { }
 */
export const UseRequestTimeout = (timeoutMs?: number) => {
  return SetMetadata(REQUEST_TIMEOUT_METADATA, { timeout: timeoutMs } as RequestTimeoutConfig);
};
