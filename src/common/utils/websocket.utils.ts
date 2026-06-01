/**
 * Shared WebSocket utilities for server and client implementations.
 */

export const WS_HEARTBEAT_INTERVAL_MS = 25_000;
export const WS_HEARTBEAT_TIMEOUT_MS = 10_000;
export const WS_MAX_PENDING_MESSAGES = 500;
export const WS_MAX_RECONNECT_ATTEMPTS = 20;

export interface PendingWsMessage {
  id: string;
  event: string;
  payload: unknown;
  seq: number;
  enqueuedAt: number;
}

/**
 * Exponential backoff delay in ms: base * 2^attempt, capped at maxMs.
 */
export function calculateReconnectDelay(
  attempt: number,
  baseMs = 1000,
  maxMs = 30_000,
): number {
  const delay = baseMs * Math.pow(2, Math.min(attempt, 10));
  return Math.min(delay, maxMs);
}

/**
 * Returns true when pending queue exceeds backpressure threshold.
 */
export function isBackpressureActive(pendingCount: number, maxPending = WS_MAX_PENDING_MESSAGES): boolean {
  return pendingCount >= maxPending * 0.9;
}
