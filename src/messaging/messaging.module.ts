import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MessagingService } from './messaging.service';
import { EventBusService } from './event-bus/event-bus.service';
import { ServiceDiscoveryService } from './discovery/service-discovery.service';
import { CircuitBreakerService } from './circuit-breaker/circuit-breaker.service';
import { TracingService } from './tracing/tracing.service';

@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    BullModule.registerQueue({
      name: 'message-queue',
    }),
    EventEmitterModule.forRoot(),
  ],
  providers: [
    MessagingService,
    EventBusService,
    ServiceDiscoveryService,
    CircuitBreakerService,
    TracingService,
  ],
  exports: [
    MessagingService,
    EventBusService,
    ServiceDiscoveryService,
    CircuitBreakerService,
    TracingService,
  ],
})
export class MessagingModule {}
