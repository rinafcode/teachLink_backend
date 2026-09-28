import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PasswordHistoryService {
  private readonly maxDepth: number;

  constructor(private config: ConfigService) {
    this.maxDepth = this.config.get<number>('PASSWORD_HISTORY_DEPTH', 5);
  }

  trimHistory(history: string[]): string[] {
    if (history.length <= this.maxDepth) return history;
    return history.slice(history.length - this.maxDepth);
  }

  addToHistory(history: string[], newHash: string): string[] {
    const updated = [...history, newHash];
    return this.trimHistory(updated);
  }
}
