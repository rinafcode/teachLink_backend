import Redis, { RedisOptions } from 'ioredis';

export const createBullRedisClient = (type: string, redisOpts?: RedisOptions) => {
  const options: RedisOptions = {
    ...(redisOpts ?? {}),
  };

  if (type !== 'client') {
    options.enableReadyCheck = false;
    options.maxRetriesPerRequest = null;
  }

  const client = new Redis(options);
  client.on('error', () => {
    // Avoid unhandled error events while Redis is unavailable.
  });

  return client;
};
