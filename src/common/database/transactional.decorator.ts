import { SetMetadata } from '@nestjs/common';

export const TRANSACTIONAL_KEY = 'transactional';

export interface TransactionalOptions {
  isolationLevel?: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
  retry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

/**
 * Decorator to mark methods as transactional
 * Usage: @Transactional() or @Transactional({ isolationLevel: 'SERIALIZABLE' })
 */
export const Transactional = (options?: TransactionalOptions) =>
  SetMetadata(TRANSACTIONAL_KEY, options || {});
