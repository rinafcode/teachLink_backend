import { Injectable } from '@nestjs/common';

@Injectable()
export class WsDrainService {
  private draining = false;
  private readonly drainPeriodMs = 30000;

  startDrain(): void {
    this.draining = true;
    setTimeout(() => {
      this.draining = false;
    }, this.drainPeriodMs);
  }

  isDraining(): boolean {
    return this.draining;
  }

  canAcceptConnection(): boolean {
    return !this.draining;
  }
}
