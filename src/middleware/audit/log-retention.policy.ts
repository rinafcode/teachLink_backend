const DEFAULT_RETENTION_DAYS = 365;

export function resolveRetentionDays(configuredDays?: number): number {
  if (!configuredDays || configuredDays < 1) {
    return DEFAULT_RETENTION_DAYS;
  }

  return configuredDays;
}

export function buildRetentionUntil(retentionDays: number, now: Date = new Date()): Date {
  const retentionUntil = new Date(now);
  retentionUntil.setDate(retentionUntil.getDate() + resolveRetentionDays(retentionDays));
  return retentionUntil;
}

export function buildRetentionCutoff(retentionDays: number, now: Date = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - resolveRetentionDays(retentionDays));
  return cutoff;
}
