import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NAMES } from '../common/constants/queue.constants';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MessagingService } from './messaging.service';
import { EventBusService } from './event-bus/event-bus.service';
import { ServiceDiscoveryService } from './discovery/service-discovery.service';
import { CircuitBreakerService } from './circuit-breaker/circuit-breaker.service';
import { TracingService } from './tracing/tracing.service';
import { createBullRedisClient } from '../common/utils/bull-redis.util';
@Module({
    imports: [
        BullModule.forRoot({
            redis: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379', 10),
            },
            createClient: createBullRedisClient,
        }),
        BullModule.registerQueue({
            name: QUEUE_NAMES.MESSAGE_QUEUE,
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
export class MessagingModule {
}
