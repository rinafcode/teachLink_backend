import { Injectable, Logger } from '@nestjs/common';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/enums/audit-action.enum';
import { IFeatureFlagsConfig, loadFeatureFlags } from './feature-flags.config';

/** A single recorded change to a feature flag. */
export interface FlagAuditEntry {
  /** Monotonically increasing entry id within this process lifetime. */
  id: number;
  /** The flag key that was changed. */
  flagKey: keyof IFeatureFlagsConfig;
  /** User ID of the actor who made the change, or `'system'` for programmatic changes. */
  actor: string;
  /** E-mail of the actor for display purposes. */
  actorEmail: string;
  /** Flag value before the change. */
  oldValue: boolean;
  /** Flag value after the change. */
  newValue: boolean;
  /** UTC timestamp of when the change was applied. */
  changedAt: Date;
}

/**
 * Wraps runtime feature flag reads and writes with a full audit trail.
 *
 * Responsibilities:
 *  - Initialise in-process flag state from the environment on startup.
 *  - Allow privileged callers to toggle individual flags at runtime without
 *    an application restart.
 *  - Emit a structured audit log entry via {@link AuditLogService} for every
 *    state change.
 *  - Maintain a ring buffer of the last {@link MAX_HISTORY} changes for the
 *    compliance endpoint.
 */
@Injectable()
export class FeatureFlagAuditService {
  private readonly logger = new Logger(FeatureFlagAuditService.name);

  /** Maximum number of audit entries retained in memory. */
  static readonly MAX_HISTORY = 100;

  /** In-process flag state, initialised from environment variables. */
  private readonly state: Map<keyof IFeatureFlagsConfig, boolean>;

  /** Ring buffer of the most recent flag changes. */
  private readonly history: FlagAuditEntry[] = [];

  /** Auto-incrementing id counter for in-memory entries. */
  private nextId = 1;

  constructor(private readonly auditLogService: AuditLogService) {
    const initial = loadFeatureFlags();
    this.state = new Map(
      (Object.keys(initial) as Array<keyof IFeatureFlagsConfig>).map((k) => [k, initial[k]]),
    );
  }

  /**
   * Returns the current runtime value of a feature flag.
   * Returns `undefined` when the key does not exist in the config.
   */
  getFlag(key: keyof IFeatureFlagsConfig): boolean | undefined {
    return this.state.get(key);
  }

  /**
   * Returns a snapshot of all current flag values.
   */
  getAllFlags(): Record<string, boolean> {
    return Object.fromEntries(this.state.entries());
  }

  /**
   * Changes the runtime value of a feature flag and records the change.
   *
   * - Emits a `CONFIG_CHANGED` audit log entry via {@link AuditLogService}.
   * - Prepends the change to the in-memory ring buffer (capped at
   *   {@link MAX_HISTORY}).
   * - No-ops silently if the new value equals the current value.
   *
   * @param key      - The flag to change.
   * @param newValue - The desired new value.
   * @param actor    - The user performing the change.
   */
  async setFlag(
    key: keyof IFeatureFlagsConfig,
    newValue: boolean,
    actor: { id: string; email: string },
  ): Promise<FlagAuditEntry> {
    const oldValue = this.state.get(key) ?? false;

    this.state.set(key, newValue);

    const entry: FlagAuditEntry = {
      id: this.nextId++,
      flagKey: key,
      actor: actor.id,
      actorEmail: actor.email,
      oldValue,
      newValue,
      changedAt: new Date(),
    };

    this.prependToHistory(entry);

    await this.emitAuditLog(entry);

    this.logger.log(
      `Feature flag "${String(key)}" changed ${String(oldValue)} → ${String(newValue)} by ${actor.email}`,
    );

    return entry;
  }

  /**
   * Returns the most recent flag audit entries, newest first.
   * The list is capped at {@link MAX_HISTORY} entries.
   */
  getAuditHistory(): FlagAuditEntry[] {
    return [...this.history];
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private prependToHistory(entry: FlagAuditEntry): void {
    this.history.unshift(entry);
    if (this.history.length > FeatureFlagAuditService.MAX_HISTORY) {
      this.history.pop();
    }
  }

  private async emitAuditLog(entry: FlagAuditEntry): Promise<void> {
    try {
      await this.auditLogService.logDataChange({
        action: AuditAction.CONFIG_CHANGED,
        userId: entry.actor,
        userEmail: entry.actorEmail,
        entityType: 'FeatureFlag',
        entityId: String(entry.flagKey),
        oldValues: { value: entry.oldValue },
        newValues: { value: entry.newValue },
        description: `Feature flag "${String(entry.flagKey)}" toggled from ${String(entry.oldValue)} to ${String(entry.newValue)}`,
      });
    } catch (err) {
      // Audit log failure must never interrupt the flag toggle itself.
      this.logger.error('Failed to emit audit log for flag change', err);
    }
  }
}
