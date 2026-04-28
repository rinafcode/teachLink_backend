import crc32 from 'crc-32';
import { createHash } from 'crypto';

/**
 * Hash utility for shard routing
 * Provides consistent hashing with virtual nodes for even data distribution
 */
export class ShardHash {
  private ring: Map<number, string> = new Map();
  private sortedKeys: number[] = [];
  private shardWeights: Map<string, number> = new Map();

  constructor(
    private shards: string[],
    private weights: Map<string, number>,
    private virtualNodesPerShard: number = 150,
  ) {
    this.buildRing();
  }

  /**
   * Build the consistent hashing ring
   */
  private buildRing(): void {
    for (const shard of this.shards) {
      const weight = this.weights.get(shard) || 1;
      const virtualNodes = this.virtualNodesPerShard * weight;

      for (let i = 0; i < virtualNodes; i++) {
        const virtualKey = `${shard}#${i}`;
        const hash = this.hash(virtualKey);
        this.ring.set(hash, shard);
        this.sortedKeys.push(hash);
      }
    }

    this.sortedKeys.sort((a, b) => a - b);
  }

  /**
   * Generate hash for a key using configured algorithm
   */
  private hash(key: string, algorithm: string = 'murmur3'): number {
    switch (algorithm) {
      case 'crc32':
        return Math.abs(crc32.str(key));
      case 'md5':
        return parseInt(createHash('md5').update(key).digest('hex').substring(0, 8), 16);
      case 'sha256':
        return parseInt(createHash('sha256').update(key).digest('hex').substring(0, 8), 16);
      case 'murmur3':
        return Math.abs(this.murmurHash(key));
      default:
        return Math.abs(this.murmurHash(key));
    }
  }

  /**
   * Simple MurmurHash3 implementation (browser-safe, no external dependencies)
   */
  private murmurHash(key: string): number {
    const c1 = 0xcc9e2d51;
    const c2 = 0x1b873593;
    const r1 = 15;
    const r2 = 13;
    const m = 5;
    const n = 0xe6546b64;

    let hash = 0;
    const bytes = new TextEncoder().encode(key);
    const blocks = Math.floor(bytes.length / 4);

    for (let i = 0; i < blocks; i++) {
      let k =
        (bytes[i * 4] & 0xff) |
        ((bytes[i * 4 + 1] & 0xff) << 8) |
        ((bytes[i * 4 + 2] & 0xff) << 16) |
        ((bytes[i * 4 + 3] & 0xff) << 24);

      k = Math.imul(k, c1);
      k = (k << r1) | (k >>> (32 - r1));
      k = Math.imul(k, c2);

      hash ^= k;
      hash = (hash << r2) | (hash >>> (32 - r2));
      hash = Math.imul(hash, m) + n;
    }

    let k1 = 0;
    const tail = bytes.length % 4;
    const tailStart = blocks * 4;

    // MurmurHash3 finalization mix - handle remaining bytes
    // The following switch intentionally omits break statements for fallthrough.
    // This is the correct MurmurHash3 algorithm implementation.
    switch (tail) {
      // @ts-expect-error: noFallthroughCasesInSwitch - intentional for MurmurHash3
      case 3:
        k1 ^= (bytes[tailStart + 2] & 0xff) << 16;
      // @ts-expect-error: noFallthroughCasesInSwitch - intentional for MurmurHash3
      case 2:
        k1 ^= (bytes[tailStart + 1] & 0xff) << 8;
      // @ts-expect-error: noFallthroughCasesInSwitch - intentional for MurmurHash3
      case 1:
        k1 ^= bytes[tailStart] & 0xff;
        k1 = Math.imul(k1, c1);
        k1 = (k1 << r1) | (k1 >>> (32 - r1));
        k1 = Math.imul(k1, c2);
        hash ^= k1;
    }

    hash ^= bytes.length;
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x85ebca6b);
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 0xc2b2ae35);
    hash ^= hash >>> 16;

    return hash;
  }

  /**
   * Get the shard for a given key using consistent hashing
   */
  getShard(key: string): string {
    if (this.ring.size === 0) {
      throw new Error('Hash ring is empty');
    }

    const hash = this.hash(key);
    const index = this.findShardIndex(hash);
    return this.ring.get(this.sortedKeys[index])!;
  }

  /**
   * Find the appropriate shard index using binary search
   */
  private findShardIndex(hash: number): number {
    let start = 0;
    let end = this.sortedKeys.length - 1;

    while (start <= end) {
      const mid = Math.floor((start + end) / 2);

      if (this.sortedKeys[mid] === hash) {
        return mid;
      }

      if (this.sortedKeys[mid] < hash) {
        start = mid + 1;
      } else {
        end = mid - 1;
      }
    }

    // Wrap around to the first shard if we're past the end
    return start % this.sortedKeys.length;
  }

  /**
   * Get all possible shards for a key (for replication)
   */
  getShards(key: string, count: number = 1): string[] {
    if (count > this.shards.length) {
      count = this.shards.length;
    }

    const hash = this.hash(key);
    const startIndex = this.findShardIndex(hash);
    const result: string[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < this.sortedKeys.length && result.length < count; i++) {
      const index = (startIndex + i) % this.sortedKeys.length;
      const shard = this.ring.get(this.sortedKeys[index])!;

      if (!seen.has(shard)) {
        seen.add(shard);
        result.push(shard);
      }
    }

    return result;
  }

  /**
   * Get the shard distribution statistics
   */
  getDistribution(): Map<string, number> {
    const distribution = new Map<string, number>();

    for (const shard of this.shards) {
      distribution.set(shard, 0);
    }

    for (const [, shard] of this.ring) {
      distribution.set(shard, (distribution.get(shard) || 0) + 1);
    }

    return distribution;
  }

  /**
   * Get all shards in the ring
   */
  getAllShards(): string[] {
    return [...new Set(this.ring.values())];
  }
}
