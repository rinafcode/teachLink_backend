import { SetMetadata } from '@nestjs/common';
import { IDEMPOTENCY_METADATA_KEY, IDEMPOTENCY_DEFAULT_HEADER_NAME, IDEMPOTENCY_DEFAULT_TTL_SECONDS } from '../constants/idempotency.constants';

export interface IdempotencyOptions {
  ttl?: number; // Time-to-live in seconds
  headerName?: string; // Custom header name for idempotency key
  lockTtlMs?: number;
  pollIntervalMs?: number;
  waitTimeoutMs?: number;
}

export const Idempotent = (options: IdempotencyOptions = {}) => {
  return SetMetadata(IDEMPOTENCY_METADATA_KEY, {
    ttl: options.ttl ?? IDEMPOTENCY_DEFAULT_TTL_SECONDS,
    headerName: options.headerName ?? IDEMPOTENCY_DEFAULT_HEADER_NAME,
    lockTtlMs: options.lockTtlMs,
    pollIntervalMs: options.pollIntervalMs,
    waitTimeoutMs: options.waitTimeoutMs,
  });
};
