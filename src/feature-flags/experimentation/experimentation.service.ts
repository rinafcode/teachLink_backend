import { Injectable } from '@nestjs/common';
import {
  IExperimentConfig,
  IExperimentResult,
  IExperimentVariant,
  IUserContext,
} from '../interfaces';
import { RolloutService } from '../rollout/rollout.service';

interface IConversionRecord {
  eventName: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Provides experimentation operations.
 */
@Injectable()
export class ExperimentationService {
  /** variantKey → userId → IConversionRecord[] */
  private readonly conversions = new Map<string, Map<string, IConversionRecord[]>>();

  constructor(private readonly rolloutService: RolloutService) {}

  /**
   * Assigns a user to an experiment variant using consistent hashing.
   * Returns null if the experiment is inactive or the user is outside traffic allocation.
   */
  assignVariant(
    config: IExperimentConfig,
    flagKey: string,
    userContext: IUserContext,
  ): IExperimentResult | null {
    if (config.status !== 'running') return null;

    const now = new Date();
    if (config.startDate && now < config.startDate) return null;
    if (config.endDate && now > config.endDate) return null;

    if (!this.isInExperimentTraffic(config, flagKey, userContext)) return null;

    const variant = this.selectVariant(config, flagKey, userContext);
    if (!variant) return null;

    return {
      experimentId: config.experimentId,
      variantKey: variant.key,
      value: variant.value,
      isControl: variant.isControl ?? false,
    };
  }

  /**
   * Records a conversion event for a user in an experiment.
   */
  trackConversion(
    experimentId: string,
    userId: string,
    eventName: string,
    metadata?: Record<string, unknown>,
  ): void {
    if (!this.conversions.has(experimentId)) {
      this.conversions.set(experimentId, new Map());
    }
    /**
     * Records a conversion event for a user in an experiment.
     */
    trackConversion(experimentId: string, userId: string, eventName: string, metadata?: Record<string, unknown>): void {
        if (!this.conversions.has(experimentId)) {
            this.conversions.set(experimentId, new Map());
        }
        const expConversions = this.conversions.get(experimentId) ?? new Map();
        if (!expConversions.has(userId)) {
            expConversions.set(userId, []);
        }
        const userConversions = expConversions.get(userId) ?? [];
        userConversions.push({ eventName, metadata, timestamp: new Date() });
    }

    const userConversions = expConversions.get(userId) ?? [];
    userConversions.push({ eventName, metadata, timestamp: new Date() });
  }

  /**
   * Returns all recorded conversion records for an experiment.
   */
  getConversions(experimentId: string): Map<string, IConversionRecord[]> {
    return this.conversions.get(experimentId) ?? new Map();
  }

  /**
   * Returns the list of experiment IDs that currently have conversion data.
   */
  getActiveExperimentIds(): string[] {
    return Array.from(this.conversions.keys());
  }

  /**
   * Checks whether a user falls within the experiment's traffic allocation percentage.
   * Uses a separate hash seed from variant assignment to avoid correlation.
   */
  private isInExperimentTraffic(
    config: IExperimentConfig,
    flagKey: string,
    userContext: IUserContext,
  ): boolean {
    const bucketValue = this.resolveBucketAttributeValue(
      config.bucketByAttribute ?? 'userId',
      userContext,
    );
    const trafficBucketKey = `${flagKey}:${config.experimentId}:traffic:${bucketValue}`;
    const bucket = this.rolloutService.computeBucketValue(trafficBucketKey);
    return bucket < config.trafficAllocation;
  }

  /**
   * Selects a variant for the user using weighted bucket assignment.
   * The same user always receives the same variant for the same experiment.
   */
  private selectVariant(
    config: IExperimentConfig,
    flagKey: string,
    userContext: IUserContext,
  ): IExperimentVariant | null {
    if (!config.variants || config.variants.length === 0) return null;

    const bucketValue = this.resolveBucketAttributeValue(
      config.bucketByAttribute ?? 'userId',
      userContext,
    );
    const variantBucketKey = `${flagKey}:${config.experimentId}:variant:${bucketValue}`;
    const bucket = this.rolloutService.computeBucketValue(variantBucketKey);

    const totalWeight = config.variants.reduce((sum, v) => sum + v.weight, 0);
    if (totalWeight === 0) return null;

    const normalizedBucket = (bucket / 100) * totalWeight;
    let cumulative = 0;

    for (const variant of config.variants) {
      cumulative += variant.weight;
      if (normalizedBucket < cumulative) {
        return variant;
      }
    }

    return config.variants[config.variants.length - 1];
  }

  private resolveBucketAttributeValue(attribute: string, userContext: IUserContext): string {
    switch (attribute) {
      case 'userId':
        return userContext.userId;
      case 'sessionId':
        return userContext.sessionId ?? userContext.userId;
      case 'email':
        return userContext.email ?? userContext.userId;
      default:
        return userContext.attributes?.[attribute]?.toString() ?? userContext.userId;
    }
}
