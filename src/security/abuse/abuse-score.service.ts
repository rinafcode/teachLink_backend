import { Injectable } from '@nestjs/common';

@Injectable()
export class AbuseScoreService {
  private scores = new Map<string, { score: number; expiresAt: number }>();

  async getCompositeScore(userId: string, ip: string): Promise<number> {
    const key = ${userId}:;
    const entry = this.scores.get(key);
    if (!entry || Date.now() > entry.expiresAt) return 0;
    return entry.score;
  }

  addSignal(userId: string, ip: string, weight: number): void {
    const key = ${userId}:;
    const entry = this.scores.get(key);
    const now = Date.now();
    const newScore = (entry && now <= entry.expiresAt ? entry.score : 0) + weight;
    this.scores.set(key, { score: newScore, expiresAt: now + 60000 });
  }
}