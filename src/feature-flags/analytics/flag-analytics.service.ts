import { Injectable } from '@nestjs/common';
import {
  EvaluationReason,
  ExperimentStats,
  ExperimentVariantStats,
  FlagAnalyticsEvent,
  FlagEvaluationStats,
  FlagSummary,
  FlagValueType,
} from '../interfaces';

type TrackEvaluationInput = Omit<FlagAnalyticsEvent, 'eventId' | 'timestamp'>;

@Injectable()
export class FlagAnalyticsService {
  /** flagKey → events */
  private readonly flagEvents = new Map<string, FlagAnalyticsEvent[]>();
  /** flagKey → Set of unique userIds */
  private readonly flagUsers = new Map<string, Set<string>>();
  /** experimentId → variantKey → impression count */
  private readonly experimentImpressions = new Map<string, Map<string, number>>();
  /** experimentId → variantKey → conversion count */
  private readonly experimentConversions = new Map<string, Map<string, number>>();

  /**
   * Records a flag evaluation event.
   */
  trackEvaluation(input: TrackEvaluationInput): void {
    const event: FlagAnalyticsEvent = {
      ...input,
      eventId: this.generateEventId(),
      timestamp: new Date(),
    };

    if (event.flagKey) {
      if (!this.flagEvents.has(event.flagKey)) {
        this.flagEvents.set(event.flagKey, []);
      }
      this.flagEvents.get(event.flagKey)!.push(event);

      if (event.userId) {
        if (!this.flagUsers.has(event.flagKey)) {
          this.flagUsers.set(event.flagKey, new Set());
        }
        this.flagUsers.get(event.flagKey)!.add(event.userId);
      }
    }
  }

  /**
   * Records an experiment impression (user saw a variant).
   */
  trackImpression(
    experimentId: string,
    variantKey: string,
    userId?: string,
    flagKey?: string,
  ): void {
    this.incrementExperimentCounter(this.experimentImpressions, experimentId, variantKey);

    this.trackEvaluation({
      eventType: 'impression',
      flagKey,
      userId,
      experimentId,
      experimentVariantKey: variantKey,
    });
  }

  /**
   * Records an experiment conversion event.
   */
  trackConversion(
    experimentId: string,
    variantKey: string,
    userId?: string,
    metadata?: Record<string, unknown>,
  ): void {
    this.incrementExperimentCounter(this.experimentConversions, experimentId, variantKey);

    this.trackEvaluation({
      eventType: 'conversion',
      userId,
      experimentId,
      experimentVariantKey: variantKey,
      metadata,
    });
  }

  /**
   * Returns evaluation statistics for a flag.
   * Optionally filters to events within the last `sinceHours` hours.
   */
  getEvaluationStats(flagKey: string, sinceHours?: number): FlagEvaluationStats {
    const allEvents = this.flagEvents.get(flagKey) ?? [];

    const events = sinceHours
      ? allEvents.filter((e) => {
          const cutoff = new Date(Date.now() - sinceHours * 3_600_000);
          return e.timestamp >= cutoff;
        })
      : allEvents;

    const evaluationsByVariation: Record<string, number> = {};
    const evaluationsByReason: Record<string, number> = {};
    let errorCount = 0;
    let evaluationCount = 0;

    for (const event of events) {
      if (event.eventType !== 'evaluation') continue;
      evaluationCount++;

      if (event.variationKey) {
        evaluationsByVariation[event.variationKey] =
          (evaluationsByVariation[event.variationKey] ?? 0) + 1;
      }

      if (event.reason) {
        evaluationsByReason[event.reason] = (evaluationsByReason[event.reason] ?? 0) + 1;
        if (event.reason === 'ERROR') errorCount++;
      }
    }

    return {
      flagKey,
      totalEvaluations: evaluationCount,
      evaluationsByVariation,
      evaluationsByReason,
      uniqueUsers: this.flagUsers.get(flagKey)?.size ?? 0,
      errorRate: evaluationCount > 0 ? errorCount / evaluationCount : 0,
    };
  }

  /**
   * Returns impression and conversion stats for all variants in an experiment.
   */
  getExperimentStats(
    experimentId: string,
    controlVariantKey?: string,
  ): ExperimentStats {
    const impressions = this.experimentImpressions.get(experimentId) ?? new Map<string, number>();
    const conversions = this.experimentConversions.get(experimentId) ?? new Map<string, number>();

    const allVariantKeys = new Set([...impressions.keys(), ...conversions.keys()]);

    let totalImpressions = 0;
    const variants: Record<string, ExperimentVariantStats> = {};

    for (const variantKey of allVariantKeys) {
      const imp = impressions.get(variantKey) ?? 0;
      const conv = conversions.get(variantKey) ?? 0;
      totalImpressions += imp;

      variants[variantKey] = {
        variantKey,
        impressions: imp,
        conversions: conv,
        conversionRate: imp > 0 ? conv / imp : 0,
        isControl: variantKey === controlVariantKey,
      };
    }

    return { experimentId, totalImpressions, variants };
  }

  /**
   * Returns the most evaluated flags, sorted by evaluation count descending.
   */
  getTopFlags(limit: number = 10): FlagSummary[] {
    const summaries: FlagSummary[] = [];

    for (const [flagKey, events] of this.flagEvents.entries()) {
      const evaluations = events.filter((e) => e.eventType === 'evaluation');
      summaries.push({
        flagKey,
        totalEvaluations: evaluations.length,
        lastEvaluatedAt: events[events.length - 1]?.timestamp,
      });
    }

    return summaries
      .sort((a, b) => b.totalEvaluations - a.totalEvaluations)
      .slice(0, limit);
  }

  /**
   * Returns the most recent evaluation events for a flag in reverse-chronological order.
   */
  getFlagEvaluationHistory(flagKey: string, limit: number = 100): FlagAnalyticsEvent[] {
    const events = this.flagEvents.get(flagKey) ?? [];
    return events
      .filter((e) => e.eventType === 'evaluation')
      .slice(-limit)
      .reverse();
  }

  /**
   * Clears stored analytics. Pass a flagKey to clear only that flag's data,
   * or call without arguments to wipe all analytics.
   */
  clearAnalytics(flagKey?: string): void {
    if (flagKey) {
      this.flagEvents.delete(flagKey);
      this.flagUsers.delete(flagKey);
      return;
    }

    this.flagEvents.clear();
    this.flagUsers.clear();
    this.experimentImpressions.clear();
    this.experimentConversions.clear();
  }

  private incrementExperimentCounter(
    store: Map<string, Map<string, number>>,
    experimentId: string,
    variantKey: string,
  ): void {
    if (!store.has(experimentId)) {
      store.set(experimentId, new Map());
    }
    const inner = store.get(experimentId)!;
    inner.set(variantKey, (inner.get(variantKey) ?? 0) + 1);
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
