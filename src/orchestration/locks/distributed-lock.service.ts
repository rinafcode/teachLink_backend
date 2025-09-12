import { Injectable } from '@nestjs/common';

@Injectable()
export class DistributedLockService {
  private locks: Set<string> = new Set();

  // Acquired a distributed lock
  async acquireLock(resource: string): Promise<boolean> {
    // TODO: Implement distributed lock acquisition
    if (this.locks.has(resource)) return false;
    this.locks.add(resource);
    return true;
  }

  // Released a distributed lock
  async releaseLock(resource: string): Promise<boolean> {
    // TODO: Implemented distributed lock release
    return this.locks.delete(resource);
  }
}
