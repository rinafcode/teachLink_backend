jest.mock('ioredis', () => {
  return jest.fn();
});

import Redis from 'ioredis';
import { DistributedLockService } from './distributed-lock.service';

describe('DistributedLockService', () => {
  let store: Map<string, string>;
  let setSpy: jest.Mock;
  let evalSpy: jest.Mock;

  beforeEach(() => {
    store = new Map<string, string>();

    setSpy = jest.fn(
      async (key: string, value: string, mode: string, ttl: number, flag: string) => {
        if (flag === 'NX' && store.has(key)) {
          return null;
        }
        store.set(key, value);
        return 'OK';
      },
    );

    evalSpy = jest.fn(async (_script: string, _numKeys: number, key: string, token: string) => {
      if (store.get(key) === token) {
        store.delete(key);
        return 1;
      }
      return 0;
    });

    (Redis as unknown as jest.Mock).mockImplementation(() => ({
      on: jest.fn(),
      set: setSpy,
      del: jest.fn(async (key: string) => {
        store.delete(key);
        return 1;
      }),
      eval: evalSpy,
    }));
  });

  it('acquires the lock using a single SET key value NX PX command', async () => {
    const service = new DistributedLockService();

    const token = await service.acquireLock('lock:test', 5000);

    expect(token).not.toBeNull();
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(setSpy).toHaveBeenCalledWith('lock:test', token, 'PX', 5000, 'NX');
  });

  it('returns null when the lock is already held', async () => {
    const service = new DistributedLockService();

    const first = await service.acquireLock('lock:test', 5000);
    const second = await service.acquireLock('lock:test', 5000);

    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it('allows exactly one caller to acquire the lock under 100 concurrent attempts', async () => {
    const service = new DistributedLockService();

    const results = await Promise.all(
      Array.from({ length: 100 }, () => service.acquireLock('lock:contended', 5000)),
    );

    const winners = results.filter((token) => token !== null);
    expect(winners).toHaveLength(1);
  });

  it('releaseLock only removes the lock if the token matches', async () => {
    const service = new DistributedLockService();
    const token = await service.acquireLock('lock:test', 5000);

    await service.releaseLock('lock:test', 'wrong-token');
    expect(await service.acquireLock('lock:test', 5000)).toBeNull();

    await service.releaseLock('lock:test', token as string);
    expect(await service.acquireLock('lock:test', 5000)).not.toBeNull();
  });

  it('withLock releases the lock even if fn throws', async () => {
    const service = new DistributedLockService();

    await expect(
      service.withLock('lock:test', 5000, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    // Lock must be free again — a fresh acquire should succeed immediately.
    const token = await service.acquireLock('lock:test', 5000);
    expect(token).not.toBeNull();
  });

  it('withLock returns the value produced by fn and releases the lock', async () => {
    const service = new DistributedLockService();

    const result = await service.withLock('lock:test', 5000, async () => 'done');

    expect(result).toBe('done');
    expect(await service.acquireLock('lock:test', 5000)).not.toBeNull();
  });

  it('withLock throws if the lock cannot be acquired', async () => {
    const service = new DistributedLockService();
    await service.acquireLock('lock:test', 5000);

    await expect(service.withLock('lock:test', 5000, async () => 'unreachable')).rejects.toThrow(
      'Could not acquire lock',
    );
  });
});
