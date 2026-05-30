import { Injectable } from '@nestjs/common';

export interface RouteTarget {
  host: string;
  weight: number;
}

@Injectable()
export class RequestRouterService {
  /**
   * Selects a target host using weighted random routing.
   * Targets with higher weight are chosen more frequently.
   */
  selectTarget(targets: RouteTarget[]): RouteTarget {
    if (targets.length === 0) throw new Error('No targets available');

    const totalWeight = targets.reduce((sum, t) => sum + t.weight, 0);
    let random = Math.random() * totalWeight;

    for (const target of targets) {
      random -= target.weight;
      if (random <= 0) return target;
    }

    return targets[targets.length - 1];
  }
}