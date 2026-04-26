import { Injectable } from '@nestjs/common';

@Injectable()
export class ShutdownStateService {
  private shuttingDown = false;

  markShuttingDown(): void {
    this.shuttingDown = true;
  }

  isShuttingDown(): boolean {
    return this.shuttingDown;
  }
}
