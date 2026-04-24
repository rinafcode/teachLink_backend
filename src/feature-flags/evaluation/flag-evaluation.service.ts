import { Injectable } from '@nestjs/common';
import {
  EvaluationReason,
  IFeatureFlag,
  IFlagEvaluationResult,
  FlagValueType,
  IUserContext,
} from '../interfaces';
import { FlagAnalyticsService } from '../analytics/flag-analytics.service';
import { ExperimentationService } from '../experimentation/experimentation.service';
import { RolloutService } from '../rollout/rollout.service';
import { TargetingService } from '../targeting/targeting.service';

/**
 * Provides flag Evaluation operations.
 */
@Injectable()
export class FlagEvaluationService {
  private readonly flags = new Map<string, IFeatureFlag>();

  constructor(
    private readonly targetingService: TargetingService,
    private readonly rolloutService: RolloutService,
    private readonly experimentationService: ExperimentationService,
    private readonly analyticsService: FlagAnalyticsService,
  ) {}

  /**
   * Evaluates a single feature flag for the given user context.
   *
   * Evaluation order:
   *  1. Flag disabled / archived  → off variation
   *  2. Prerequisites             → off variation if unmet
   *  3. Targeting rules           → matched variation
   *  4. A/B experiment            → assigned variant
   *  5. Gradual rollout           → default variation
   *  6. Default                   → default variation
   */
  evaluate(flagKey: string, userContext: IUserContext): IFlagEvaluationResult {
    try {
      const flag = this.flags.get(flagKey);

      if (!flag) {
        const result = this.errorResult(flagKey);
        this.recordEvaluation(result, userContext);
        return result;
      }

      if (flag.archived || !flag.enabled) {
        const result = this.buildResult(flag, flag.offVariationKey, 'FLAG_DISABLED');
        this.recordEvaluation(result, userContext);
        return result;
      }

      // Prerequisites
      if (flag.prerequisites?.length) {
        for (const prereq of flag.prerequisites) {
          const prereqResult = this.evaluate(prereq.flagKey, userContext);
          if (prereqResult.variationKey !== prereq.requiredVariationKey) {
            const result = this.buildResult(flag, flag.offVariationKey, 'PREREQUISITE_FAILED');
            this.recordEvaluation(result, userContext);
            return result;
          }
        }
      }

      // Targeting rules
      if (flag.targeting) {
        const matchedVariationKey = this.targetingService.evaluateTargeting(
          flag.targeting,
          userContext,
        );
        if (matchedVariationKey !== null) {
          const result = this.buildResult(flag, matchedVariationKey, 'TARGETING_MATCH');
          this.recordEvaluation(result, userContext);
          return result;
        }
      }

      // A/B experiment
      if (flag.experiment) {
        const experimentResult = this.experimentationService.assignVariant(
          flag.experiment,
          flagKey,
          userContext,
        );
        if (experimentResult) {
          const result: IFlagEvaluationResult = {
            flagKey,
            value: experimentResult.value,
            variationKey: this.variationKeyForValue(flag, experimentResult.value),
            reason: 'EXPERIMENT',
            experimentId: experimentResult.experimentId,
            experimentVariantKey: experimentResult.variantKey,
            timestamp: new Date(),
          };

          this.recordEvaluation(result, userContext);
          this.analyticsService.trackImpression(
            experimentResult.experimentId,
            experimentResult.variantKey,
            userContext.userId,
            flagKey,
          );

          return result;
        }
      }

      // Gradual rollout
      if (flag.rollout) {
        const inRollout = this.rolloutService.isUserInRollout(flag.rollout, flagKey, userContext);
        if (inRollout) {
          const result = this.buildResult(flag, flag.defaultVariationKey, 'ROLLOUT');
          this.recordEvaluation(result, userContext);
          return result;
        } else {
          // User is outside the rollout window → serve off variation
          const result = this.buildResult(flag, flag.offVariationKey, 'DEFAULT');
          this.recordEvaluation(result, userContext);
          return result;
        }
      }

      // Default
      const result = this.buildResult(flag, flag.defaultVariationKey, 'DEFAULT');
      this.recordEvaluation(result, userContext);
      return result;
    } catch {
      const flag = this.flags.get(flagKey);
      const result = flag
        ? this.buildResult(flag, flag.offVariationKey, 'ERROR')
        : this.errorResult(flagKey);
      this.recordEvaluation(result, userContext);
      return result;
    }
  }

  /**
   * Evaluates all registered flags for the given user context.
   */
  evaluateAll(userContext: IUserContext): Record<string, IFlagEvaluationResult> {
    const results: Record<string, IFlagEvaluationResult> = {};
    for (const flagKey of this.flags.keys()) {
      results[flagKey] = this.evaluate(flagKey, userContext);
    }
    return results;
  }

  /**
   * Convenience method — returns the boolean value of a flag.
   */
  evaluateBoolean(flagKey: string, userContext: IUserContext, defaultValue = false): boolean {
    const result = this.evaluate(flagKey, userContext);
    return result.reason === 'ERROR' ? defaultValue : Boolean(result.value);
  }

  /**
   * Convenience method — returns the string value of a flag.
   */
  evaluateString(flagKey: string, userContext: IUserContext, defaultValue = ''): string {
    const result = this.evaluate(flagKey, userContext);
    return result.reason === 'ERROR' ? defaultValue : String(result.value);
  }

  /**
   * Convenience method — returns the numeric value of a flag.
   */
  evaluateNumber(flagKey: string, userContext: IUserContext, defaultValue = 0): number {
    const result = this.evaluate(flagKey, userContext);
    return result.reason === 'ERROR' ? defaultValue : Number(result.value);
  }

  // ---------------------------------------------------------------------------
  // Flag management
  // ---------------------------------------------------------------------------

  setFlag(flag: IFeatureFlag): void {
    this.flags.set(flag.key, { ...flag, updatedAt: new Date() });
  }

  setFlags(flags: IFeatureFlag[]): void {
    for (const flag of flags) {
      this.setFlag(flag);
    }
  }

  /**
   * Updates flag.
   * @param flagKey The flag key.
   * @param updates The updates.
   * @returns The operation result.
   */
  updateFlag(
    flagKey: string,
    updates: Partial<Omit<IFeatureFlag, 'key' | 'id'>>,
  ): IFeatureFlag | null {
    const existing = this.flags.get(flagKey);
    if (!existing) return null;

    const updated: IFeatureFlag = {
      ...existing,
      ...updates,
      key: existing.key,
      id: existing.id,
      version: existing.version + 1,
      updatedAt: new Date(),
    };

    this.flags.set(flagKey, updated);
    return updated;
  }

  /**
   * Removes flag.
   * @param flagKey The flag key.
   * @returns Whether the operation succeeded.
   */
  removeFlag(flagKey: string): boolean {
    return this.flags.delete(flagKey);
  }

  getFlag(flagKey: string): IFeatureFlag | undefined {
    return this.flags.get(flagKey);
  }

  getAllFlags(): IFeatureFlag[] {
    return Array.from(this.flags.values());
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private buildResult(
    flag: IFeatureFlag,
    variationKey: string,
    reason: EvaluationReason,
    ruleId?: string,
  ): IFlagEvaluationResult {
    const variation = flag.variations.find((v) => v.key === variationKey);
    const value: FlagValueType = variation?.value ?? flag.variations[0]?.value ?? false;

    return { flagKey: flag.key, value, variationKey, reason, ruleId, timestamp: new Date() };
  }

  private errorResult(flagKey: string): IFlagEvaluationResult {
    return {
      flagKey,
      value: false,
      variationKey: 'off',
      reason: 'ERROR',
      timestamp: new Date(),
    };
  }

  private variationKeyForValue(flag: IFeatureFlag, value: FlagValueType): string {
    return flag.variations.find((v) => v.value === value)?.key ?? flag.defaultVariationKey;
  }

  private recordEvaluation(result: IFlagEvaluationResult, userContext: IUserContext): void {
    this.analyticsService.trackEvaluation({
      eventType: 'evaluation',
      flagKey: result.flagKey,
      userId: userContext.userId,
      sessionId: userContext.sessionId,
      variationKey: result.variationKey,
      experimentId: result.experimentId,
      experimentVariantKey: result.experimentVariantKey,
      reason: result.reason,
      value: result.value,
    });
  }
}
