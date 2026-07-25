import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Counter, Registry } from 'prom-client';
import Redis from 'ioredis';
import { SessionService } from '../session.service';
import { SESSION_REDIS_CLIENT } from '../session.constants';

/**
 * Periodic job that removes stale members from user session sorted-set indexes.
 * Primary session keys expire via Redis TTL; this job reconciles the secondary
 * index so it does not grow unbounded.
 */
@Injectable()
export class SessionCleanupTask {
  private readonly logger = new Logger(SessionCleanupTask.name);
  private readonly removedCounter: Counter;

  constructor(
    private readonly sessionService: SessionService,
    @Inject(SESSION_REDIS_CLIENT) private readonly redis: Redis,
  ) {
    const registry = new Registry();
    this.removedCounter = new Counter({
      name: 'session_cleanup_removed_total',
      help: 'Total stale session index entries removed by cleanup job',
      registers: [registry],
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handleCleanup(): Promise<void> {
    this.logger.log('Starting expired session index cleanup...');
    let removedTotal = 0;

    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          'user:sessions:*',
          'COUNT',
          100,
        );
        cursor = nextCursor;

        for (const key of keys) {
          const userId = key.replace('user:sessions:', '');
          const sids = await this.sessionService.getUserSessionIds(userId);

          for (const sid of sids) {
            const exists = await this.sessionService.getSession(sid);
            if (!exists) {
              await this.sessionService.removeSessionFromUserIndex(userId, sid);
              removedTotal++;
            }
          }
        }
      } while (cursor !== '0');

      this.removedCounter.inc(removedTotal);
      this.logger.log(`Cleanup complete. Removed ${removedTotal} stale session index entries.`);
    } catch (error) {
      this.logger.error('Session index cleanup failed:', error);
    }
  }
}
