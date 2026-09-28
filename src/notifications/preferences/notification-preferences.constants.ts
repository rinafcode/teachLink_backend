/**
 * Event types that are security-critical and must never be disabled.
 *
 * These alert on account compromise or financial impact (new-device login,
 * password change, payment receipts, account deletion). A user — or an
 * attacker who has hijacked a session — must not be able to silence them,
 * so they are excluded from `eventFrequency: 'never'`, `topicSubscriptions:
 * false`, channel toggling and `unsubscribe`.
 */
export const SECURITY_CRITICAL_EVENT_TYPES: ReadonlySet<string> = new Set([
  'login_from_new_device',
  'password_change',
  'payment_receipt',
  'account_deletion',
]);

/**
 * Allowlist of every event type the platform knows about.
 *
 * Incoming `eventFrequency` / `topicSubscriptions` keys are validated against
 * this set and unknown keys are rejected with a 400 so preference records
 * stay bounded and typo'd event types cannot be silently persisted.
 */
export const KNOWN_EVENT_TYPES: ReadonlySet<string> = new Set([
  ...SECURITY_CRITICAL_EVENT_TYPES,
  'course_update',
  'enrollment_confirmed',
  'instructor_payout',
]);

/**
 * Valid delivery-channel preference keys (mirrors the entity columns).
 */
export type NotificationChannelKey = 'emailEnabled' | 'pushEnabled' | 'inAppEnabled' | 'smsEnabled';

export const CHANNEL_KEYS: readonly NotificationChannelKey[] = [
  'emailEnabled',
  'pushEnabled',
  'inAppEnabled',
  'smsEnabled',
];

/**
 * Valid event-frequency values stored in `eventFrequency`.
 */
export const EVENT_FREQUENCIES: ReadonlySet<string> = new Set([
  'instant',
  'daily',
  'weekly',
  'never',
]);
