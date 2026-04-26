/**
 * A/B testing constants.
 * Centralizes magic numbers for experiment configuration and decision making.
 */
export const AB_TESTING_CONSTANTS = {
  // Statistical thresholds
  DEFAULT_CONFIDENCE_LEVEL: 95,
  MINIMUM_SAMPLE_SIZE: 100,
  EFFECT_SIZE_THRESHOLD: 0.1,
  DURATION_THRESHOLD_DAYS: 7,
} as const;
