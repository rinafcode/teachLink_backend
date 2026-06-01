import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NAMES } from '../common/constants/queue.constants';
import { MessagingService } from './messaging.service';
import { MessagingController } from './message.controller';
import { MessageGateway } from './message.gateway';
import { Message } from './message.entity';
import { ConnectionSessionService } from './websocket-resilience/connection-session.service';
import { WebSocketResilienceService } from './websocket-resilience/websocket-resilience.service';
import { TracingService } from './tracing/tracing.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message]),
    BullModule.forRoot({
      redis: process.env.QUEUE_REDIS_URL || process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    }),
    BullModule.registerQueue({ name: QUEUE_NAMES.MESSAGE_QUEUE }),
  ],
  providers: [
    MessagingService,
    MessageGateway,
    ConnectionSessionService,
    WebSocketResilienceService,
    TracingService,
  ],
  controllers: [MessagingController],
  exports: [MessagingService],
})
export class MessagingModule {}
