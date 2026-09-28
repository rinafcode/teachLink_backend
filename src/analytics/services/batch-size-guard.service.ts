import { Injectable } from '@nestjs/common';

@Injectable()
export class BatchSizeGuardService {
  private readonly maxSize: number = 10000;
  private droppedCount: number = 0;

  canAdd(currentSize: number): boolean {
    if (currentSize >= this.maxSize) {
      this.droppedCount++;
      return false;
    }
    return true;
  }

  getDroppedCount(): number {
    return this.droppedCount;
  }

  resetDroppedCount(): void {
    this.droppedCount = 0;
  }
}
