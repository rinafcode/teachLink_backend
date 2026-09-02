import { Global, Module } from '@nestjs/common';
import { RedisModule } from '../common/redis/redis.module';
import { REDIS_CLIENT } from '../common/redis/redis.constants';
import { SESSION_REDIS_CLIENT } from './session.constants';
import { SessionService } from './session.service';
import { SessionCleanupTask } from './tasks/session-cleanup.task';

/**
 * Registers the session module.
 *
 * Issue #837 — `SESSION_REDIS_CLIENT` is aliased to the shared
 * `REDIS_CLIENT` connection (standalone/Sentinel/Cluster, see
 * `RedisModule`) instead of opening its own connection.
 */
@Global()
@Module({
  imports: [RedisModule.forRoot()],
  providers: [
    { provide: SESSION_REDIS_CLIENT, useExisting: REDIS_CLIENT },
    SessionService,
    SessionCleanupTask,
  ],
  exports: [SESSION_REDIS_CLIENT, SessionService],
})
export class SessionModule {}
