import { Injectable, Logger } from "@nestjs/common"
import type { Repository } from "typeorm"
import { type TraceSpan, SpanKind } from "../entities/trace-span.entity"
import type { TraceContext } from "../interfaces/messaging.interfaces"
import * as crypto from "crypto"
import { AsyncLocalStorage } from "async_hooks"

export class Span {
  private startTime: Date
  private tags: Record<string, any> = {}
  private logs: Array<{ timestamp: Date; level: string; message: string; fields: Record<string, any> }> = []

  constructor(
    private readonly traceId: string,
    private readonly spanId: string,
    private readonly operationName: string,
    private readonly serviceName: string,
    private readonly kind: SpanKind,
    private readonly parentSpanId?: string,
    private readonly tracingService?: DistributedTracingService,
  ) {
    this.startTime = new Date()
  }

  setTag(key: string, value: any): Span {
    this.tags[key] = value
    return this
  }

  setTags(tags: Record<string, any>): Span {
    Object.assign(this.tags, tags)
    return this
  }

  log(level: string, message: string, fields: Record<string, any> = {}): Span {
    this.logs.push({
      timestamp: new Date(),
      level,
      message,
      fields,
    })
    return this
  }

  logInfo(message: string, fields?: Record<string, any>): Span {
    return this.log("info", message, fields)
  }

  logError(message: string, fields?: Record<string, any>): Span {
    return this.log("error", message, fields)
  }

  logWarn(message: string, fields?: Record<string, any>): Span {
    return this.log("warn", message, fields)
  }

  async finish(): Promise<void> {
    const endTime = new Date()
    const duration = endTime.getTime() - this.startTime.getTime()

    if (this.tracingService) {
      await this.tracingService.finishSpan({
        traceId: this.traceId,
        spanId: this.spanId,
        parentSpanId: this.parentSpanId,
        serviceName: this.serviceName,
        operationName: this.operationName,
        kind: this.kind,
        startTime: this.startTime,
        endTime,
        duration,
        tags: this.tags,
        logs: this.logs,
        status: this.tags.error ? "error" : "ok",
        errorMessage: this.tags.error ? this.tags["error.message"] : undefined,
      })
    }
  }

  getContext(): TraceContext {
    return {
      traceId: this.traceId,
      spanId: this.spanId,
      parentSpanId: this.parentSpanId,
    }
  }
}

@Injectable()
export class DistributedTracingService {
  private readonly logger = new Logger(DistributedTracingService.name)
  private readonly contextStorage = new AsyncLocalStorage<TraceContext>()
  private readonly serviceName = process.env.SERVICE_NAME || "unknown-service"

  constructor(private readonly traceSpanRepository: Repository<TraceSpan>) {}

  startTrace(operationName: string, tags?: Record<string, any>): Span {
    const traceId = crypto.randomUUID()
    const spanId = crypto.randomUUID()

    const span = new Span(traceId, spanId, operationName, this.serviceName, SpanKind.SERVER, undefined, this)

    if (tags) {
      span.setTags(tags)
    }

    // Set context for this trace
    this.contextStorage.enterWith({
      traceId,
      spanId,
    })

    return span
  }

  startSpan(operationName: string, tags?: Record<string, any>, kind: SpanKind = SpanKind.INTERNAL): Span {
    const currentContext = this.getCurrentContext()
    const spanId = crypto.randomUUID()

    const span = new Span(
      currentContext?.traceId || crypto.randomUUID(),
      spanId,
      operationName,
      this.serviceName,
      kind,
      currentContext?.spanId,
      this,
    )

    if (tags) {
      span.setTags(tags)
    }

    return span
  }

  startChildSpan(parentSpan: Span, operationName: string, tags?: Record<string, any>): Span {
    const parentContext = parentSpan.getContext()
    const spanId = crypto.randomUUID()

    const span = new Span(
      parentContext.traceId,
      spanId,
      operationName,
      this.serviceName,
      SpanKind.INTERNAL,
      parentContext.spanId,
      this,
    )

    if (tags) {
      span.setTags(tags)
    }

    return span
  }

  getCurrentContext(): TraceContext | undefined {
    return this.contextStorage.getStore()
  }

  async runWithContext<T>(context: TraceContext, fn: () => Promise<T>): Promise<T> {
    return this.contextStorage.run(context, fn)
  }

  async finishSpan(spanData: {
    traceId: string
    spanId: string
    parentSpanId?: string
    serviceName: string
    operationName: string
    kind: SpanKind
    startTime: Date
    endTime: Date
    duration: number
    tags?: Record<string, any>
    logs?: Array<{ timestamp: Date; level: string; message: string; fields: Record<string, any> }>
    status?: string
    errorMessage?: string
  }): Promise<void> {
    try {
      const traceSpan = this.traceSpanRepository.create({
        traceId: spanData.traceId,
        spanId: spanData.spanId,
        parentSpanId: spanData.parentSpanId,
        serviceName: spanData.serviceName,
        operationName: spanData.operationName,
        kind: spanData.kind,
        startTime: spanData.startTime,
        endTime: spanData.endTime,
        duration: spanData.duration,
        tags: spanData.tags,
        logs: spanData.logs,
        status: spanData.status,
        errorMessage: spanData.errorMessage,
      })

      await this.traceSpanRepository.save(traceSpan)
    } catch (error) {
      this.logger.error(`Failed to save trace span: ${error.message}`)
    }
  }

  async getTrace(traceId: string): Promise<TraceSpan[]> {
    return this.traceSpanRepository.find({
      where: { traceId },
      order: { startTime: "ASC" },
    })
  }

  async getTraceTree(traceId: string): Promise<any> {
    const spans = await this.getTrace(traceId)
    const spanMap = new Map<string, any>()

    // Create span objects
    for (const span of spans) {
      spanMap.set(span.spanId, {
        ...span,
        children: [],
      })
    }

    // Build tree structure
    const rootSpans = []
    for (const span of spans) {
      const spanObj = spanMap.get(span.spanId)
      if (span.parentSpanId) {
        const parent = spanMap.get(span.parentSpanId)
        if (parent) {
          parent.children.push(spanObj)
        }
      } else {
        rootSpans.push(spanObj)
      }
    }

    return rootSpans
  }

  async searchTraces(filters: {
    serviceName?: string
    operationName?: string
    tags?: Record<string, any>
    minDuration?: number
    maxDuration?: number
    startTime?: Date
    endTime?: Date
    limit?: number
  }): Promise<{ traceId: string; spans: TraceSpan[] }[]> {
    const queryBuilder = this.traceSpanRepository.createQueryBuilder("span")

    if (filters.serviceName) {
      queryBuilder.andWhere("span.serviceName = :serviceName", { serviceName: filters.serviceName })
    }

    if (filters.operationName) {
      queryBuilder.andWhere("span.operationName = :operationName", { operationName: filters.operationName })
    }

    if (filters.minDuration) {
      queryBuilder.andWhere("span.duration >= :minDuration", { minDuration: filters.minDuration })
    }

    if (filters.maxDuration) {
      queryBuilder.andWhere("span.duration <= :maxDuration", { maxDuration: filters.maxDuration })
    }

    if (filters.startTime) {
      queryBuilder.andWhere("span.startTime >= :startTime", { startTime: filters.startTime })
    }

    if (filters.endTime) {
      queryBuilder.andWhere("span.endTime <= :endTime", { endTime: filters.endTime })
    }

    if (filters.tags) {
      for (const [key, value] of Object.entries(filters.tags)) {
        queryBuilder.andWhere("span.tags ->> :key = :value", { key, value })
      }
    }

    queryBuilder.orderBy("span.startTime", "DESC")

    if (filters.limit) {
      queryBuilder.limit(filters.limit)
    }

    const spans = await queryBuilder.getMany()

    // Group by trace ID
    const traceMap = new Map<string, TraceSpan[]>()
    for (const span of spans) {
      if (!traceMap.has(span.traceId)) {
        traceMap.set(span.traceId, [])
      }
      traceMap.get(span.traceId)!.push(span)
    }

    return Array.from(traceMap.entries()).map(([traceId, spans]) => ({
      traceId,
      spans,
    }))
  }

  async getTracingMetrics(): Promise<{
    totalTraces: number
    totalSpans: number
    averageTraceLength: number
    averageSpanDuration: number
    errorRate: number
    serviceBreakdown: Record<string, number>
    operationBreakdown: Record<string, number>
  }> {
    const [totalSpans, errorSpans] = await Promise.all([
      this.traceSpanRepository.count(),
      this.traceSpanRepository.count({ where: { status: "error" } }),
    ])

    const traceCount = await this.traceSpanRepository
      .createQueryBuilder("span")
      .select("COUNT(DISTINCT span.traceId)", "count")
      .getRawOne()

    const avgDuration = await this.traceSpanRepository
      .createQueryBuilder("span")
      .select("AVG(span.duration)", "avg")
      .getRawOne()

    const serviceBreakdown = await this.traceSpanRepository
      .createQueryBuilder("span")
      .select("span.serviceName", "service")
      .addSelect("COUNT(*)", "count")
      .groupBy("span.serviceName")
      .getRawMany()

    const operationBreakdown = await this.traceSpanRepository
      .createQueryBuilder("span")
      .select("span.operationName", "operation")
      .addSelect("COUNT(*)", "count")
      .groupBy("span.operationName")
      .getRawMany()

    return {
      totalTraces: Number.parseInt(traceCount.count) || 0,
      totalSpans,
      averageTraceLength: totalSpans / (Number.parseInt(traceCount.count) || 1),
      averageSpanDuration: Number.parseFloat(avgDuration.avg) || 0,
      errorRate: totalSpans > 0 ? errorSpans / totalSpans : 0,
      serviceBreakdown: serviceBreakdown.reduce(
        (acc, item) => {
          acc[item.service] = Number.parseInt(item.count)
          return acc
        },
        {} as Record<string, number>,
      ),
      operationBreakdown: operationBreakdown.reduce(
        (acc, item) => {
          acc[item.operation] = Number.parseInt(item.count)
          return acc
        },
        {} as Record<string, number>,
      ),
    }
  }
}
