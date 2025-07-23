import { Controller, Post, Get, Put, Delete, Param, Query, BadRequestException } from "@nestjs/common"
import type { MessageQueueService } from "../services/message-queue.service"
import type { EventBusService } from "../services/event-bus.service"
import type { ServiceDiscoveryService } from "../services/service-discovery.service"
import type { CircuitBreakerService } from "../services/circuit-breaker.service"
import type { DistributedTracingService } from "../services/distributed-tracing.service"
import type { HealthCheckService } from "../services/health-check.service"
import type { Message, Event, ServiceInfo } from "../interfaces/messaging.interfaces"
import type { ServiceStatus } from "../entities/service-registry.entity"

@Controller("messaging")
export class MessagingController {
  constructor(
    private readonly messageQueueService: MessageQueueService,
    private readonly eventBusService: EventBusService,
    private readonly serviceDiscoveryService: ServiceDiscoveryService,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly distributedTracingService: DistributedTracingService,
    private readonly healthCheckService: HealthCheckService,
  ) {}

  // Message Queue Endpoints
  @Post("messages")
  async sendMessage(message: Omit<Message, "id" | "metadata">) {
    if (!message.type || !message.source || !message.payload) {
      throw new BadRequestException("Missing required fields: type, source, payload")
    }

    const messageId = await this.messageQueueService.sendMessage(message)
    return { messageId, status: "queued" }
  }

  @Post("messages/bulk")
  async sendBulkMessages(body: { messages: Array<Omit<Message, "id" | "metadata">> }) {
    if (!body.messages || !Array.isArray(body.messages)) {
      throw new BadRequestException("Messages array is required")
    }

    const messageIds = await this.messageQueueService.sendBulkMessages(body.messages)
    return { messageIds, status: "queued", count: messageIds.length }
  }

  @Post("messages/schedule")
  async scheduleMessage(body: { message: Omit<Message, "id" | "metadata">; delay: number }) {
    if (!body.message || typeof body.delay !== "number") {
      throw new BadRequestException("Message and delay are required")
    }

    const messageId = await this.messageQueueService.scheduleMessage(body.message, body.delay)
    return { messageId, status: "scheduled" }
  }

  @Get("messages/:messageId")
  async getMessageStatus(@Param("messageId") messageId: string) {
    const message = await this.messageQueueService.getMessageStatus(messageId)
    if (!message) {
      throw new BadRequestException("Message not found")
    }
    return message
  }

  @Post("messages/:messageId/retry")
  async retryMessage(@Param("messageId") messageId: string) {
    const success = await this.messageQueueService.retryMessage(messageId)
    return { success, status: success ? "retrying" : "failed" }
  }

  @Delete("messages/:messageId")
  async cancelMessage(@Param("messageId") messageId: string) {
    const success = await this.messageQueueService.cancelMessage(messageId)
    return { success, status: success ? "cancelled" : "not_found" }
  }

  @Get("messages/stats")
  async getQueueStats() {
    return this.messageQueueService.getQueueStats()
  }

  // Event Bus Endpoints
  @Post("events")
  async publishEvent(event: Omit<Event, "id" | "timestamp" | "metadata">) {
    if (!event.type || !event.source || !event.data) {
      throw new BadRequestException("Missing required fields: type, source, data")
    }

    const eventId = await this.eventBusService.publishEvent(event)
    return { eventId, status: "published" }
  }

  @Post("events/bulk")
  async publishBulkEvents(body: { events: Array<Omit<Event, "id" | "timestamp" | "metadata">> }) {
    if (!body.events || !Array.isArray(body.events)) {
      throw new BadRequestException("Events array is required")
    }

    const eventIds = await this.eventBusService.publishBulkEvents(body.events)
    return { eventIds, status: "published", count: eventIds.length }
  }

  @Get("events/stats")
  async getEventStats() {
    return this.eventBusService.getEventStats()
  }

  // Service Discovery Endpoints
  @Post("services/register")
  async registerService(serviceInfo: Partial<ServiceInfo>) {
    const serviceId = await this.serviceDiscoveryService.registerService(serviceInfo)
    return { serviceId, status: "registered" }
  }

  @Delete("services/:serviceId")
  async deregisterService(@Param("serviceId") serviceId: string) {
    await this.serviceDiscoveryService.deregisterService(serviceId)
    return { status: "deregistered" }
  }

  @Get("services")
  async discoverServices(@Query("serviceName") serviceName?: string, @Query("tags") tags?: string) {
    const tagList = tags ? tags.split(",") : undefined
    return this.serviceDiscoveryService.discoverServices(serviceName, tagList)
  }

  @Get("services/:serviceName")
  async getServiceByName(@Param("serviceName") serviceName: string) {
    const service = await this.serviceDiscoveryService.getServiceByName(serviceName)
    if (!service) {
      throw new BadRequestException("Service not found")
    }
    return service
  }

  @Get("services/:serviceName/load-balance")
  async loadBalanceService(
    @Param("serviceName") serviceName: string,
    @Query("strategy") strategy: "round-robin" | "least-connections" | "random" = "round-robin",
  ) {
    const service = await this.serviceDiscoveryService.loadBalance(serviceName, strategy)
    if (!service) {
      throw new BadRequestException("No healthy services found")
    }
    return service
  }

  @Put("services/:serviceId/status")
  async updateServiceStatus(@Param("serviceId") serviceId: string, body: { status: ServiceStatus }) {
    await this.serviceDiscoveryService.updateServiceStatus(serviceId, body.status)
    return { status: "updated" }
  }

  @Get("services/metrics")
  async getServiceMetrics() {
    return this.serviceDiscoveryService.getServiceMetrics()
  }

  // Circuit Breaker Endpoints
  @Get("circuit-breakers/:serviceName/:operation")
  async getCircuitBreakerState(@Param("serviceName") serviceName: string, @Param("operation") operation: string) {
    const state = await this.circuitBreakerService.getCircuitBreakerState(serviceName, operation)
    if (!state) {
      throw new BadRequestException("Circuit breaker not found")
    }
    return state
  }

  @Post("circuit-breakers/:serviceName/:operation/reset")
  async resetCircuitBreaker(@Param("serviceName") serviceName: string, @Param("operation") operation: string) {
    await this.circuitBreakerService.resetCircuitBreaker(serviceName, operation)
    return { status: "reset" }
  }

  @Post("circuit-breakers/:serviceName/:operation/open")
  async forceOpenCircuit(
    @Param("serviceName") serviceName: string,
    @Param("operation") operation: string,
    body?: { recoveryTimeout?: number },
  ) {
    await this.circuitBreakerService.forceOpenCircuit(serviceName, operation, body?.recoveryTimeout)
    return { status: "opened" }
  }

  @Post("circuit-breakers/:serviceName/:operation/close")
  async forceCloseCircuit(@Param("serviceName") serviceName: string, @Param("operation") operation: string) {
    await this.circuitBreakerService.forceCloseCircuit(serviceName, operation)
    return { status: "closed" }
  }

  @Get("circuit-breakers/metrics")
  async getCircuitBreakerMetrics() {
    return this.circuitBreakerService.getCircuitBreakerMetrics()
  }

  // Distributed Tracing Endpoints
  @Get("traces/:traceId")
  async getTrace(@Param("traceId") traceId: string) {
    return this.distributedTracingService.getTrace(traceId)
  }

  @Get("traces/:traceId/tree")
  async getTraceTree(@Param("traceId") traceId: string) {
    return this.distributedTracingService.getTraceTree(traceId)
  }

  @Get("traces/search")
  async searchTraces(
    @Query("serviceName") serviceName?: string,
    @Query("operationName") operationName?: string,
    @Query("minDuration") minDuration?: string,
    @Query("maxDuration") maxDuration?: string,
    @Query("startTime") startTime?: string,
    @Query("endTime") endTime?: string,
    @Query("limit") limit?: string,
  ) {
    const filters: any = {}
    if (serviceName) filters.serviceName = serviceName
    if (operationName) filters.operationName = operationName
    if (minDuration) filters.minDuration = Number.parseInt(minDuration)
    if (maxDuration) filters.maxDuration = Number.parseInt(maxDuration)
    if (startTime) filters.startTime = new Date(startTime)
    if (endTime) filters.endTime = new Date(endTime)
    if (limit) filters.limit = Number.parseInt(limit)

    return this.distributedTracingService.searchTraces(filters)
  }

  @Get("traces/metrics")
  async getTracingMetrics() {
    return this.distributedTracingService.getTracingMetrics()
  }

  // Health Check Endpoints
  @Get("health")
  async getHealth() {
    return this.healthCheckService.performComprehensiveHealthCheck()
  }

  @Get("health/service")
  async checkServiceHealth(@Query("url") url: string, @Query("timeout") timeout?: string) {
    if (!url) {
      throw new BadRequestException("URL is required")
    }

    const timeoutMs = timeout ? Number.parseInt(timeout) : 5000
    const isHealthy = await this.healthCheckService.checkServiceHealth(url, timeoutMs)

    return { url, healthy: isHealthy }
  }
}
