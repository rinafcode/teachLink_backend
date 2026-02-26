import { Injectable } from '@nestjs/common';
import { RolloutConfig, UserContext } from '../interfaces';

@Injectable()
export class RolloutService {
  /**
   * Determines whether a user falls within the configured rollout percentage.
   * Uses consistent hashing so the same user always gets the same result.
   */
  isUserInRollout(config: RolloutConfig, flagKey: string, userContext: UserContext): boolean {
    const now = new Date();

    if (config.startDate && now < config.startDate) return false;
    if (config.endDate && now > config.endDate) return false;

    const currentPercentage = this.getCurrentPercentage(config);
    if (currentPercentage <= 0) return false;
    if (currentPercentage >= 100) return true;

    const bucketKey = this.resolveBucketKey(config.bucketByAttribute ?? 'userId', userContext);
    const bucketValue = this.computeBucketValue(`${flagKey}:${bucketKey}`);

    return bucketValue < currentPercentage;
  }

  /**
   * Returns the effective rollout percentage at the current time,
   * accounting for any ramp schedule defined on the config.
   */
  getCurrentPercentage(config: RolloutConfig): number {
    if (!config.rampSchedule || config.rampSchedule.length === 0) {
      return config.percentage;
    }

    const now = new Date();
    const sortedSteps = [...config.rampSchedule].sort(
      (a, b) => a.at.getTime() - b.at.getTime(),
    );

    let effective = 0;
    for (const step of sortedSteps) {
      if (now >= step.at) {
        effective = step.percentage;
      } else {
        break;
      }
    }

    return Math.min(effective, config.percentage);
  }

  /**
   * DJB2 hash — fast, deterministic, and well-distributed.
   * Returns a value in the range [0, 99].
   */
  computeBucketValue(key: string): number {
    let hash = 5381;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) + hash + key.charCodeAt(i)) >>> 0;
    }
    return hash % 100;
  }

  private resolveBucketKey(attribute: string, userContext: UserContext): string {
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
}
