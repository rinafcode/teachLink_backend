import { Injectable, Logger, type OnModuleInit, type OnModuleDestroy } from "@nestjs/common"
import type { Repository } from "typeorm"
import { Cron, CronExpression } from "@nestjs/schedule"
import { type ServiceRegistry, ServiceStatus } from "../entities/service-registry.entity"
import type { ServiceInfo } from "../interfaces/messaging.interfaces"
import type { HealthCheckService } from "./health-check.service"
import * as crypto from "crypto"
import * as os from "os"

@Injectable()
export class ServiceDiscoveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ServiceDiscoveryService.name)
  private readonly serviceId = crypto.randomUUID()
  private readonly serviceName = process.env.SERVICE_NAME || "unknown-service"
  private readonly serviceVersion = process.env.SERVICE_VERSION || "1.0.0"
  private readonly host = process.env.HOST || os.hostname()
  private readonly port = Number.parseInt(process.env.PORT) || 3000
  private heartbeatInterval: NodeJS.Timeout | null = null

  constructor(
    private readonly serviceRegistryRepository: Repository<ServiceRegistry>,
    private readonly healthCheckService: HealthCheckService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.registerService()
    this.startHeartbeat()
  }

  async onModuleDestroy(): Promise<void> {
    await this.deregisterService()
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }
  }

  async registerService(serviceInfo?: Partial<ServiceInfo>): Promise<string> {
    const service = this.serviceRegistryRepository.create({
      serviceName: serviceInfo?.serviceName || this.serviceName,
      serviceId: serviceInfo?.serviceId || this.serviceId,
      version: serviceInfo?.version || this.serviceVersion,
      host: serviceInfo?.host || this.host,
      port: serviceInfo?.port || this.port,
      status: ServiceStatus.HEALTHY,
      metadata: serviceInfo?.metadata || {
        tags: ["api", "microservice"],
        capabilities: ["http", "messaging"],
        endpoints: [
          { path: "/health", method: "GET", description: "Health check endpoint" },
          { path: "/metrics", method: "GET", description: "Metrics endpoint" },
        ],
        resources: this.getResourceInfo(),
      },
      healthCheck: serviceInfo?.healthCheck || {
        endpoint: "/health",
        interval: 30000,
        timeout: 5000,
        retries: 3,
      },
      lastHeartbeat: new Date(),
      failureCount: 0,
      responseTime: 0,
      requestCount: 0,
    })

    const savedService = await this.serviceRegistryRepository.save(service)
    this.logger.log(`Service ${this.serviceName} registered with ID: ${this.serviceId}`)

    return savedService.id
  }

  async deregisterService(serviceId?: string): Promise<void> {
    const id = serviceId || this.serviceId
    await this.serviceRegistryRepository.delete({ serviceId: id })
    this.logger.log(`Service ${id} deregistered`)
  }

  async updateServiceStatus(serviceId: string, status: ServiceStatus, metadata?: any): Promise<void> {
    const updates: any = { status, lastHeartbeat: new Date() }
    if (metadata) updates.metadata = metadata

    await this.serviceRegistryRepository.update({ serviceId }, updates)
  }

  async discoverServices(serviceName?: string, tags?: string[]): Promise<ServiceRegistry[]> {
    const queryBuilder = this.serviceRegistryRepository.createQueryBuilder("service")

    queryBuilder.where("service.status IN (:...statuses)", {
      statuses: [ServiceStatus.HEALTHY, ServiceStatus.DEGRADED],
    })

    if (serviceName) {
      queryBuilder.andWhere("service.serviceName = :serviceName", { serviceName })
    }

    if (tags && tags.length > 0) {
      queryBuilder.andWhere("service.metadata->>'tags' ?| array[:...tags]", { tags })
    }

    queryBuilder.orderBy("service.responseTime", "ASC")

    return queryBuilder.getMany()
  }

  async getServiceByName(serviceName: string): Promise<ServiceRegistry | null> {
    return this.serviceRegistryRepository.findOne({
      where: {
        serviceName,
        status: ServiceStatus.HEALTHY,
      },
      order: { responseTime: "ASC" },
    })
  }

  async getServiceById(serviceId: string): Promise<ServiceRegistry | null> {
    return this.serviceRegistryRepository.findOne({
      where: { serviceId },
    })
  }

  async getHealthyServices(): Promise<ServiceRegistry[]> {
    return this.serviceRegistryRepository.find({
      where: { status: ServiceStatus.HEALTHY },
      order: { responseTime: "ASC" },
    })
  }

  async loadBalance(
    serviceName: string,
    strategy: "round-robin" | "least-connections" | "random" = "round-robin",
  ): Promise<ServiceRegistry | null> {
    const services = await this.discoverServices(serviceName)

    if (services.length === 0) {
      return null
    }

    switch (strategy) {
      case "round-robin":
        return this.roundRobinSelection(services)
      case "least-connections":
        return this.leastConnectionsSelection(services)
      case "random":
        return services[Math.floor(Math.random() * services.length)]
      default:
        return services[0]
    }
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async performHealthChecks(): Promise<void> {
    const services = await this.serviceRegistryRepository.find()

    for (const service of services) {
      try {
        const isHealthy = await this.healthCheckService.checkServiceHealth(
          `http://${service.host}:${service.port}${service.healthCheck.endpoint}`,
          service.healthCheck.timeout,
        )

        if (isHealthy) {
          if (service.status !== ServiceStatus.HEALTHY) {
            await this.updateServiceStatus(service.serviceId, ServiceStatus.HEALTHY)
            this.logger.log(`Service ${service.serviceName} is now healthy`)
          }
          await this.serviceRegistryRepository.update(
            { serviceId: service.serviceId },
            { failureCount: 0, lastHeartbeat: new Date() },
          )
        } else {
          const newFailureCount = service.failureCount + 1
          const newStatus =
            newFailureCount >= service.healthCheck.retries ? ServiceStatus.UNHEALTHY : ServiceStatus.DEGRADED

          await this.serviceRegistryRepository.update(
            { serviceId: service.serviceId },
            { failureCount: newFailureCount, status: newStatus },
          )

          if (newStatus === ServiceStatus.UNHEALTHY) {
            this.logger.warn(`Service ${service.serviceName} marked as unhealthy`)
          }
        }
      } catch (error) {
        this.logger.error(`Health check failed for service ${service.serviceName}: ${error.message}`)
      }
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async cleanupStaleServices(): Promise<void> {
    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago

    const result = await this.serviceRegistryRepository.delete({
      lastHeartbeat: { $lt: staleThreshold },
    })

    if (result.affected && result.affected > 0) {
      this.logger.log(`Cleaned up ${result.affected} stale services`)
    }
  }

  async getServiceMetrics(): Promise<{
    totalServices: number
    healthyServices: number
    unhealthyServices: number
    servicesByStatus: Record<string, number>
    averageResponseTime: number
  }> {
    const services = await this.serviceRegistryRepository.find()

    const totalServices = services.length
    const healthyServices = services.filter((s) => s.status === ServiceStatus.HEALTHY).length
    const unhealthyServices = services.filter((s) => s.status === ServiceStatus.UNHEALTHY).length

    const servicesByStatus = services.reduce(
      (acc, service) => {
        acc[service.status] = (acc[service.status] || 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )

    const averageResponseTime =
      services.length > 0 ? services.reduce((sum, s) => sum + Number(s.responseTime), 0) / services.length : 0

    return {
      totalServices,
      healthyServices,
      unhealthyServices,
      servicesByStatus,
      averageResponseTime,
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.serviceRegistryRepository.update(
          { serviceId: this.serviceId },
          {
            lastHeartbeat: new Date(),
            metadata: {
              ...((await this.getServiceById(this.serviceId))?.metadata || {}),
              resources: this.getResourceInfo(),
            },
          },
        )
      } catch (error) {
        this.logger.error(`Heartbeat failed: ${error.message}`)
      }
    }, 30000) // 30 seconds
  }

  private getResourceInfo() {
    const memUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()

    return {
      cpu: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
      memory: memUsage.heapUsed / 1024 / 1024, // Convert to MB
      disk: 0, // Would need additional library to get disk usage
    }
  }

  private roundRobinSelection(services: ServiceRegistry[]): ServiceRegistry {
    // Simple round-robin implementation
    // In production, you'd want to maintain state across requests
    const index = Math.floor(Date.now() / 1000) % services.length
    return services[index]
  }

  private leastConnectionsSelection(services: ServiceRegistry[]): ServiceRegistry {
    // Select service with least request count
    return services.reduce((prev, current) => (prev.requestCount < current.requestCount ? prev : current))
  }
}
