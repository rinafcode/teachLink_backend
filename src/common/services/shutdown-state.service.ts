import { Injectable } from '@nestjs/common';

@Injectable()
export class ShutdownStateService {
  private shuttingDown = false;
  private shutdownStartTime: number | null = null;
  private shutdownReason: string | null = null;

  markShuttingDown(reason?: string): void {
    if (!this.shuttingDown) {
      this.shuttingDown = true;
      this.shutdownStartTime = Date.now();
      this.shutdownReason = reason || 'Unknown';
    }
  }

  isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  getShutdownInfo(): {
    isShuttingDown: boolean;
    startTime: number | null;
    reason: string | null;
    durationMs: number | null;
  } {
    return {
      isShuttingDown: this.shuttingDown,
      startTime: this.shutdownStartTime,
      reason: this.shutdownReason,
      durationMs: this.shutdownStartTime ? Date.now() - this.shutdownStartTime : null,
    };
  }

  reset(): void {
    this.shuttingDown = false;
    this.shutdownStartTime = null;
    this.shutdownReason = null;
  }
}
