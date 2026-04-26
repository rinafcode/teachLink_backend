/**
 * Shared time/duration constants used across the application.
 * Centralizes magic numbers for timeouts, TTLs, and delays.
 */
export const TIME = {
  // Milliseconds
  ONE_SECOND_MS: 1_000,
  TWO_SECONDS_MS: 2_000,
  THREE_SECONDS_MS: 3_000,
  FIVE_SECONDS_MS: 5_000,
  TEN_SECONDS_MS: 10_000,
  FIFTEEN_SECONDS_MS: 15_000,
  TWENTY_SECONDS_MS: 20_000,
  THIRTY_SECONDS_MS: 30_000,
  FORTY_FIVE_SECONDS_MS: 45_000,
  ONE_MINUTE_MS: 60_000,
  TWO_MINUTES_MS: 120_000,
  FIFTEEN_MINUTES_MS: 900_000,
  ONE_HOUR_MS: 3_600_000,

  // Seconds
  FIVE_MINUTES_SECONDS: 300,
  ONE_HOUR_SECONDS: 3_600,
  ONE_DAY_SECONDS: 86_400,
  ONE_WEEK_SECONDS: 604_800,
  ONE_YEAR_SECONDS: 31_536_000,
} as const;

/**
 * Byte size constants used across the application.
 */
export const BYTES = {
  ONE_KB: 1_024,
  ONE_MB_BYTES: 1_048_576, // 1024 * 1024
  TEN_MB_BYTES: 10_485_760, // 10 * 1024 * 1024
} as const;
