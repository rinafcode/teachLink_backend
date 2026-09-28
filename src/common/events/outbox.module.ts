import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxEvent } from './outbox.entity';
import { OutboxService } from './outbox.service';
import { OutboxRelayService } from './outbox-relay.service';

/**
 * Transactional outbox module (issue #1221).
 *
 * Import where outbox writes are needed (producers) and once at the app root
 * so the relay runs for the lifetime of the process. NestJS shares the module
 * instance across importers, so the relay is started a single time.
 */
@Module({
  imports: [TypeOrmModule.forFeature([OutboxEvent])],
  providers: [OutboxService, OutboxRelayService],
  exports: [OutboxService],
})
export class OutboxModule {}
