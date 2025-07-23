import { Test, type TestingModule } from "@nestjs/testing"
import { getRepositoryToken, getQueueToken } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import type { Queue } from "bull"
import { MessageQueueService } from "./services/message-queue.service"
import { ServiceDiscoveryService } from "./services/service-discovery.service"
import { CircuitBreakerService } from "./services/circuit-breaker.service"
import { DistributedTracingService } from "./services/distributed-tracing.service"
import { MessageLog, MessageStatus } from "./entities/message-log.entity"
import { ServiceRegistry, ServiceStatus } from "./entities/service-registry.entity"
import { CircuitBreakerState, CircuitState } from "./entities/circuit-breaker-state.entity"
import { MessagePriority } from "./interfaces/messaging.interfaces"
import { jest } from "@jest/globals"

describe("MessageQueueService", () => {
  let service: MessageQueueService
  let messageQueue: Queue
  let messageLogRepository: Repository<MessageLog>

  const mockMessageQueue = {
    add: jest.fn(),
    addBulk: jest.fn(),
    getJobs: jest.fn(),
    getWaiting: jest.fn(),
    getActive: jest.fn(),
    getCompleted: jest.fn(),
    getFailed: jest.fn(),
    getDelayed: jest.fn(),
    isPaused: jest.fn(),
    clean: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
  }

  const mockMessageLogRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  }

  const mockTracingService = {
    getCurrentContext: jest.fn(),
    startSpan: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageQueueService,
        {
          provide: getQueueToken("message-queue"),
          useValue: mockMessageQueue,
        },
        {
          provide: getQueueToken("retry-queue"),
          useValue: mockMessageQueue,
        },
        {
          provide: getQueueToken("dead-letter-queue"),
          useValue: mockMessageQueue,
        },
        {
          provide: getRepositoryToken(MessageLog),
          useValue: mockMessageLogRepository,
        },
        {
          provide: DistributedTracingService,
          useValue: mockTracingService,
        },
      ],
    }).compile()

    service = module.get<MessageQueueService>(MessageQueueService)
    messageQueue = module.get<Queue>(getQueueToken("message-queue"))
    messageLogRepository = module.get<Repository<MessageLog>>(getRepositoryToken(MessageLog))
  })

  it("should be defined", () => {
    expect(service).toBeDefined()
  })

  describe("sendMessage", () => {
    it("should send a message successfully", async () => {
      const message = {
        type: "user.created",
        source: "user-service",
        target: "notification-service",
        payload: { userId: "123", email: "test@example.com" },
        priority: MessagePriority.HIGH,
      }

      const mockSpan = {
        setTag: jest.fn(),
        finish: jest.fn(),
      }

      mockTracingService.getCurrentContext.mockReturnValue({
        traceId: "trace-123",
        spanId: "span-123",
      })
      mockTracingService.startSpan.mockReturnValue(mockSpan)
      mockMessageLogRepository.create.mockReturnValue({})
      mockMessageLogRepository.save.mockResolvedValue({})
      mockMessageQueue.add.mockResolvedValue({})

      const messageId = await service.sendMessage(message)

      expect(messageId).toBeDefined()
      expect(mockMessageQueue.add).toHaveBeenCalledWith(
        "process-message",
        expect.objectContaining({
          type: message.type,
          source: message.source,
          target: message.target,
          payload: message.payload,
          priority: message.priority,
        }),
        expect.objectContaining({
          priority: 2, // HIGH priority = 2 (5 - 3)
          attempts: 4, // maxRetries + 1
        }),
      )
      expect(mockSpan.setTag).toHaveBeenCalledWith("success", true)
    })

    it("should handle message sending failure", async () => {
      const message = {
        type: "user.created",
        source: "user-service",
        payload: { userId: "123" },
      }

      const mockSpan = {
        setTag: jest.fn(),
        finish: jest.fn(),
      }

      mockTracingService.getCurrentContext.mockReturnValue(null)
      mockTracingService.startSpan.mockReturnValue(mockSpan)
      mockMessageLogRepository.create.mockReturnValue({})
      mockMessageLogRepository.save.mockResolvedValue({})
      mockMessageQueue.add.mockRejectedValue(new Error("Queue error"))
      mockMessageLogRepository.update.mockResolvedValue({})

      await expect(service.sendMessage(message)).rejects.toThrow("Queue error")
      expect(mockSpan.setTag).toHaveBeenCalledWith("error", true)
      expect(mockMessageLogRepository.update).toHaveBeenCalled()
    })
  })

  describe("sendBulkMessages", () => {
    it("should send multiple messages", async () => {
      const messages = [
        { type: "user.created", source: "user-service", payload: { userId: "123" } },
        { type: "user.updated", source: "user-service", payload: { userId: "456" } },
      ]

      mockTracingService.getCurrentContext.mockReturnValue(null)
      mockMessageLogRepository.create.mockReturnValue({})
      mockMessageLogRepository.save.mockResolvedValue({})
      mockMessageQueue.addBulk.mockResolvedValue([])

      const messageIds = await service.sendBulkMessages(messages)

      expect(messageIds).toHaveLength(2)
      expect(mockMessageQueue.addBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: "process-message",
            data: expect.objectContaining({ type: "user.created" }),
          }),
          expect.objectContaining({
            name: "process-message",
            data: expect.objectContaining({ type: "user.updated" }),
          }),
        ]),
      )
    })
  })

  describe("retryMessage", () => {
    it("should retry a message successfully", async () => {
      const messageId = "msg-123"
      const mockMessageLog = {
        messageId,
        metadata: { retryCount: 1, maxRetries: 3 },
        payload: { userId: "123" },
        status: MessageStatus.FAILED,
      }

      mockMessageLogRepository.findOne.mockResolvedValue(mockMessageLog)
      mockMessageLogRepository.save.mockResolvedValue({})
      mockMessageQueue.add.mockResolvedValue({})

      const result = await service.retryMessage(messageId)

      expect(result).toBe(true)
      expect(mockMessageLog.metadata.retryCount).toBe(2)
      expect(mockMessageLog.status).toBe(MessageStatus.PENDING)
      expect(mockMessageQueue.add).toHaveBeenCalledWith(
        "retry-message",
        { messageId, originalMessage: mockMessageLog.payload },
        expect.objectContaining({ delay: expect.any(Number) }),
      )
    })

    it("should move to dead letter queue when max retries exceeded", async () => {
      const messageId = "msg-123"
      const mockMessageLog = {
        messageId,
        metadata: { retryCount: 3, maxRetries: 3 },
        payload: { userId: "123" },
      }

      mockMessageLogRepository.findOne.mockResolvedValue(mockMessageLog)
      mockMessageQueue.add.mockResolvedValue({})
      mockMessageLogRepository.update.mockResolvedValue({})

      const result = await service.retryMessage(messageId)

      expect(result).toBe(false)
      expect(mockMessageQueue.add).toHaveBeenCalledWith(
        "dead-letter-message",
        expect.objectContaining({
          messageId,
          reason: "Max retries exceeded",
        }),
      )
    })
  })
})

describe("ServiceDiscoveryService", () => {
  let service: ServiceDiscoveryService
  let serviceRegistryRepository: Repository<ServiceRegistry>

  const mockServiceRegistryRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  }

  const mockHealthCheckService = {
    checkServiceHealth: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceDiscoveryService,
        {
          provide: getRepositoryToken(ServiceRegistry),
          useValue: mockServiceRegistryRepository,
        },
        {
          provide: "HealthCheckService",
          useValue: mockHealthCheckService,
        },
      ],
    }).compile()

    service = module.get<ServiceDiscoveryService>(ServiceDiscoveryService)
    serviceRegistryRepository = module.get<Repository<ServiceRegistry>>(getRepositoryToken(ServiceRegistry))
  })

  it("should be defined", () => {
    expect(service).toBeDefined()
  })

  describe("registerService", () => {
    it("should register a service successfully", async () => {
      const serviceInfo = {
        serviceName: "user-service",
        version: "1.0.0",
        host: "localhost",
        port: 3001,
      }

      const mockService = { id: "service-123", ...serviceInfo }
      mockServiceRegistryRepository.create.mockReturnValue(mockService)
      mockServiceRegistryRepository.save.mockResolvedValue(mockService)

      const serviceId = await service.registerService(serviceInfo)

      expect(serviceId).toBe("service-123")
      expect(mockServiceRegistryRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceName: serviceInfo.serviceName,
          version: serviceInfo.version,
          host: serviceInfo.host,
          port: serviceInfo.port,
          status: ServiceStatus.HEALTHY,
        }),
      )
    })
  })

  describe("discoverServices", () => {
    it("should discover services by name", async () => {
      const mockServices = [
        { serviceName: "user-service", status: ServiceStatus.HEALTHY },
        { serviceName: "user-service", status: ServiceStatus.HEALTHY },
      ]

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockServices),
      }

      mockServiceRegistryRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder)

      const services = await service.discoverServices("user-service")

      expect(services).toEqual(mockServices)
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith("service.serviceName = :serviceName", {
        serviceName: "user-service",
      })
    })

    it("should discover services by tags", async () => {
      const mockServices = [{ serviceName: "api-service", status: ServiceStatus.HEALTHY }]

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockServices),
      }

      mockServiceRegistryRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder)

      const services = await service.discoverServices(undefined, ["api", "microservice"])

      expect(services).toEqual(mockServices)
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith("service.metadata->>'tags' ?| array[:...tags]", {
        tags: ["api", "microservice"],
      })
    })
  })

  describe("loadBalance", () => {
    it("should return null when no services available", async () => {
      jest.spyOn(service, "discoverServices").mockResolvedValue([])

      const result = await service.loadBalance("user-service")

      expect(result).toBeNull()
    })

    it("should return a service using round-robin strategy", async () => {
      const mockServices = [
        { serviceName: "user-service", responseTime: 100 },
        { serviceName: "user-service", responseTime: 200 },
      ] as ServiceRegistry[]

      jest.spyOn(service, "discoverServices").mockResolvedValue(mockServices)

      const result = await service.loadBalance("user-service", "round-robin")

      expect(result).toBeDefined()
      expect(mockServices).toContain(result)
    })
  })
})

describe("CircuitBreakerService", () => {
  let service: CircuitBreakerService
  let circuitBreakerRepository: Repository<CircuitBreakerState>

  const mockCircuitBreakerRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    increment: jest.fn(),
    find: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CircuitBreakerService,
        {
          provide: getRepositoryToken(CircuitBreakerState),
          useValue: mockCircuitBreakerRepository,
        },
      ],
    }).compile()

    service = module.get<CircuitBreakerService>(CircuitBreakerService)
    circuitBreakerRepository = module.get<Repository<CircuitBreakerState>>(getRepositoryToken(CircuitBreakerState))
  })

  it("should be defined", () => {
    expect(service).toBeDefined()
  })

  describe("executeWithCircuitBreaker", () => {
    it("should execute function successfully when circuit is closed", async () => {
      const mockCircuitBreaker = {
        id: "cb-123",
        state: CircuitState.CLOSED,
        failureCount: 0,
        successCount: 5,
      }

      mockCircuitBreakerRepository.findOne.mockResolvedValue(null)
      mockCircuitBreakerRepository.create.mockReturnValue(mockCircuitBreaker)
      mockCircuitBreakerRepository.save.mockResolvedValue(mockCircuitBreaker)
      mockCircuitBreakerRepository.increment.mockResolvedValue({})
      mockCircuitBreakerRepository.update.mockResolvedValue({})

      const testFunction = jest.fn().mockResolvedValue("success")

      const result = await service.executeWithCircuitBreaker("user-service", "getUser", testFunction)

      expect(result).toBe("success")
      expect(testFunction).toHaveBeenCalled()
      expect(mockCircuitBreakerRepository.increment).toHaveBeenCalledWith({ id: "cb-123" }, "successCount", 1)
    })

    it("should throw CircuitBreakerOpenException when circuit is open", async () => {
      const mockCircuitBreaker = {
        id: "cb-123",
        state: CircuitState.OPEN,
        nextAttemptTime: new Date(Date.now() + 60000), // 1 minute in future
      }

      mockCircuitBreakerRepository.findOne.mockResolvedValue(mockCircuitBreaker)

      const testFunction = jest.fn()

      await expect(service.executeWithCircuitBreaker("user-service", "getUser", testFunction)).rejects.toThrow(
        "Circuit breaker is open for user-service:getUser",
      )

      expect(testFunction).not.toHaveBeenCalled()
    })

    it("should transition to half-open when recovery timeout has passed", async () => {
      const mockCircuitBreaker = {
        id: "cb-123",
        state: CircuitState.OPEN,
        nextAttemptTime: new Date(Date.now() - 1000), // 1 second ago
      }

      mockCircuitBreakerRepository.findOne.mockResolvedValue(mockCircuitBreaker)
      mockCircuitBreakerRepository.update.mockResolvedValue({})
      mockCircuitBreakerRepository.increment.mockResolvedValue({})

      const testFunction = jest.fn().mockResolvedValue("success")

      const result = await service.executeWithCircuitBreaker("user-service", "getUser", testFunction)

      expect(result).toBe("success")
      expect(mockCircuitBreakerRepository.update).toHaveBeenCalledWith("cb-123", { state: CircuitState.HALF_OPEN })
      expect(mockCircuitBreakerRepository.update).toHaveBeenCalledWith("cb-123", { state: CircuitState.CLOSED })
    })

    it("should record failure and potentially open circuit", async () => {
      const mockCircuitBreaker = {
        id: "cb-123",
        state: CircuitState.CLOSED,
        failureCount: 4, // One less than threshold
        requestCount: 15,
      }

      const updatedCircuitBreaker = {
        ...mockCircuitBreaker,
        failureCount: 5,
        requestCount: 16,
      }

      mockCircuitBreakerRepository.findOne
        .mockResolvedValueOnce(null) // First call for getOrCreate
        .mockResolvedValueOnce(updatedCircuitBreaker) // Second call after failure

      mockCircuitBreakerRepository.create.mockReturnValue(mockCircuitBreaker)
      mockCircuitBreakerRepository.save.mockResolvedValue(mockCircuitBreaker)
      mockCircuitBreakerRepository.increment.mockResolvedValue({})
      mockCircuitBreakerRepository.update.mockResolvedValue({})

      const testFunction = jest.fn().mockRejectedValue(new Error("Service error"))

      await expect(service.executeWithCircuitBreaker("user-service", "getUser", testFunction)).rejects.toThrow(
        "Service error",
      )

      expect(mockCircuitBreakerRepository.increment).toHaveBeenCalledWith({ id: "cb-123" }, "failureCount", 1)
    })
  })

  describe("resetCircuitBreaker", () => {
    it("should reset circuit breaker state", async () => {
      mockCircuitBreakerRepository.update.mockResolvedValue({})

      await service.resetCircuitBreaker("user-service", "getUser")

      expect(mockCircuitBreakerRepository.update).toHaveBeenCalledWith(
        { serviceName: "user-service", operation: "getUser" },
        expect.objectContaining({
          state: CircuitState.CLOSED,
          failureCount: 0,
          successCount: 0,
          requestCount: 0,
        }),
      )
    })
  })
})
