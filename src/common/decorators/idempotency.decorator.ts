import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENCY_KEY_METADATA = 'idempotency:ttl';

export interface IdempotencyOptions {
  ttl?: number; // Time-to-live in seconds
  headerName?: string; // Custom header name for idempotency key
}

export const Idempotent = (options: IdempotencyOptions = {}) => {
  const ttl = options.ttl || 86400; // Default 24 hours
  return SetMetadata(IDEMPOTENCY_KEY_METADATA, ttl);
};
