import { Module, Global } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { BullModule } from "@nestjs/bull"
import { ScheduleModule } from "@nestjs/schedule"
import { TypeOrmModule } from "@nestjs/typeorm"
import { MessageQueueService } from "./services/message-queue.service"
import { EventBusService } from "./services/event-bus.service"
import { ServiceDiscoveryService } from "./services/service-discovery.service"
import { CircuitBreakerService } from "./services/circuit-breaker.service"
import { DistributedTracingService } from "./services/distributed-tracing.service"
import { HealthCheckService } from "./services/health-check.service"
import { MessagingController } from "./controllers/messaging.controller"
import { ServiceRegistry } from "./entities/service-registry.entity"
import { MessageLog } from "./entities/message-log.entity"
import { CircuitBreakerState } from "./entities/circuit-breaker-state.entity"
import { TraceSpan } from "./entities/trace-span.entity"
import { MessageProcessor } from "./processors/message.processor"
import { EventProcessor } from "./processors/event.processor"

@Global()
@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([ServiceRegistry, MessageLog, CircuitBreakerState, TraceSpan]),
    BullModule.registerQueue(
      { name: "message-queue" },
      { name: "event-bus" },
      { name: "dead-letter-queue" },
      { name: "retry-queue" },
    ),
  ],
  controllers: [MessagingController],
  providers: [
    MessageQueueService,
    EventBusService,
    ServiceDiscoveryService,
    CircuitBreakerService,
    DistributedTracingService,
    HealthCheckService,
    MessageProcessor,
    EventProcessor,
  ],
  exports: [
    MessageQueueService,
    EventBusService,
    ServiceDiscoveryService,
    CircuitBreakerService,
    DistributedTracingService,
    HealthCheckService,
  ],
})
export class MessagingModule {}
