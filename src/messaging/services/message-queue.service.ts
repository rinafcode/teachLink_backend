import { Injectable, Logger } from "@nestjs/common"
import type { Queue } from "bull"
import type { Repository } from "typeorm"
import { type MessageLog, MessageStatus, MessagePriority } from "../entities/message-log.entity"
import type { Message, MessageQueueConfig } from "../interfaces/messaging.interfaces"
import type { DistributedTracingService } from "./distributed-tracing.service"
import * as crypto from "crypto"

@Injectable()
export class MessageQueueService {
  private readonly logger = new Logger(MessageQueueService.name)
  private readonly config: MessageQueueConfig = {
    defaultQueue: "message-queue",
    retryQueue: "retry-queue",
    deadLetterQueue: "dead-letter-queue",
    maxRetries: 3,
    retryDelay: 5000,
    messageTimeout: 30000,
  }

  private readonly messageQueue: Queue
  private readonly retryQueue: Queue
  private readonly deadLetterQueue: Queue
  private readonly messageLogRepository: Repository<MessageLog>
  private readonly tracingService: DistributedTracingService

  constructor(
    messageQueue: Queue,
    retryQueue: Queue,
    deadLetterQueue: Queue,
    messageLogRepository: Repository<MessageLog>,
    tracingService: DistributedTracingService,
  ) {
    this.messageQueue = messageQueue
    this.retryQueue = retryQueue
    this.deadLetterQueue = deadLetterQueue
    this.messageLogRepository = messageLogRepository
    this.tracingService = tracingService
  }

  async sendMessage(message: Omit<Message, "id" | "metadata">): Promise<string> {
    const messageId = crypto.randomUUID()
    const traceContext = this.tracingService.getCurrentContext()

    const fullMessage: Message = {
      ...message,
      id: messageId,
      metadata: {
        traceId: traceContext?.traceId || crypto.randomUUID(),
        spanId: crypto.randomUUID(),
        correlationId: message.headers?.correlationId || crypto.randomUUID(),
        retryCount: 0,
        maxRetries: this.config.maxRetries,
        delay: 0,
        timeout: this.config.messageTimeout,
      },
    }

    // Log message
    await this.logMessage(fullMessage, MessageStatus.PENDING)

    // Start trace span
    const span = this.tracingService.startSpan("message.send", {
      messageId,
      messageType: message.type,
      source: message.source,
      target: message.target,
    })

    try {
      // Add to queue with priority
      await this.messageQueue.add("process-message", fullMessage, {
        priority: this.getPriorityValue(message.priority),
        delay: message.scheduledAt ? message.scheduledAt.getTime() - Date.now() : 0,
        attempts: this.config.maxRetries + 1,
        backoff: {
          type: "exponential",
          delay: this.config.retryDelay,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      })

      this.logger.log(`Message ${messageId} queued successfully`)
      span.setTag("success", true)
      return messageId
    } catch (error) {
      this.logger.error(`Failed to queue message ${messageId}: ${error.message}`)
      span.setTag("error", true)
      span.setTag("error.message", error.message)
      await this.updateMessageStatus(messageId, MessageStatus.FAILED, error.message)
      throw error
    } finally {
      span.finish()
    }
  }

  async sendBulkMessages(messages: Array<Omit<Message, "id" | "metadata">>): Promise<string[]> {
    const messageIds: string[] = []
    const jobs = []

    for (const message of messages) {
      const messageId = crypto.randomUUID()
      const traceContext = this.tracingService.getCurrentContext()

      const fullMessage: Message = {
        ...message,
        id: messageId,
        metadata: {
          traceId: traceContext?.traceId || crypto.randomUUID(),
          spanId: crypto.randomUUID(),
          correlationId: message.headers?.correlationId || crypto.randomUUID(),
          retryCount: 0,
          maxRetries: this.config.maxRetries,
          delay: 0,
          timeout: this.config.messageTimeout,
        },
      }

      messageIds.push(messageId)
      jobs.push({
        name: "process-message",
        data: fullMessage,
        opts: {
          priority: this.getPriorityValue(message.priority),
          delay: message.scheduledAt ? message.scheduledAt.getTime() - Date.now() : 0,
        },
      })

      // Log message
      await this.logMessage(fullMessage, MessageStatus.PENDING)
    }

    await this.messageQueue.addBulk(jobs)
    this.logger.log(`${messages.length} messages queued successfully`)

    return messageIds
  }

  async scheduleMessage(message: Omit<Message, "id" | "metadata">, delay: number): Promise<string> {
    const scheduledAt = new Date(Date.now() + delay)
    return this.sendMessage({ ...message, scheduledAt })
  }

  async cancelMessage(messageId: string): Promise<boolean> {
    try {
      const jobs = await this.messageQueue.getJobs(["waiting", "delayed"])
      const job = jobs.find((j) => j.data.id === messageId)

      if (job) {
        await job.remove()
        await this.updateMessageStatus(messageId, MessageStatus.FAILED, "Cancelled by user")
        this.logger.log(`Message ${messageId} cancelled successfully`)
        return true
      }

      return false
    } catch (error) {
      this.logger.error(`Failed to cancel message ${messageId}: ${error.message}`)
      return false
    }
  }

  async retryMessage(messageId: string): Promise<boolean> {
    try {
      const messageLog = await this.messageLogRepository.findOne({
        where: { messageId },
      })

      if (!messageLog) {
        throw new Error(`Message ${messageId} not found`)
      }

      if (messageLog.metadata.retryCount >= messageLog.metadata.maxRetries) {
        await this.moveToDeadLetter(messageLog)
        return false
      }

      // Increment retry count
      messageLog.metadata.retryCount++
      messageLog.status = MessageStatus.PENDING

      await this.messageLogRepository.save(messageLog)

      // Add to retry queue with exponential backoff
      const delay = Math.pow(2, messageLog.metadata.retryCount) * this.config.retryDelay

      await this.retryQueue.add(
        "retry-message",
        {
          messageId,
          originalMessage: messageLog.payload,
        },
        { delay },
      )

      this.logger.log(`Message ${messageId} scheduled for retry (attempt ${messageLog.metadata.retryCount})`)
      return true
    } catch (error) {
      this.logger.error(`Failed to retry message ${messageId}: ${error.message}`)
      return false
    }
  }

  async getMessageStatus(messageId: string): Promise<MessageLog | null> {
    return this.messageLogRepository.findOne({
      where: { messageId },
    })
  }

  async getQueueStats(): Promise<{
    waiting: number
    active: number
    completed: number
    failed: number
    delayed: number
    paused: boolean
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.messageQueue.getWaiting(),
      this.messageQueue.getActive(),
      this.messageQueue.getCompleted(),
      this.messageQueue.getFailed(),
      this.messageQueue.getDelayed(),
    ])

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      paused: await this.messageQueue.isPaused(),
    }
  }

  async purgeQueue(queueName: "message" | "retry" | "dead-letter" = "message"): Promise<void> {
    const queue = this.getQueueByName(queueName)
    await queue.clean(0, "completed")
    await queue.clean(0, "failed")
    this.logger.log(`Queue ${queueName} purged successfully`)
  }

  async pauseQueue(queueName: "message" | "retry" | "dead-letter" = "message"): Promise<void> {
    const queue = this.getQueueByName(queueName)
    await queue.pause()
    this.logger.log(`Queue ${queueName} paused`)
  }

  async resumeQueue(queueName: "message" | "retry" | "dead-letter" = "message"): Promise<void> {
    const queue = this.getQueueByName(queueName)
    await queue.resume()
    this.logger.log(`Queue ${queueName} resumed`)
  }

  private async logMessage(message: Message, status: MessageStatus, errorMessage?: string): Promise<void> {
    const messageLog = this.messageLogRepository.create({
      messageId: message.id,
      messageType: message.type,
      sourceService: message.source,
      targetService: message.target || "broadcast",
      status,
      priority: message.priority || MessagePriority.NORMAL,
      payload: message.payload,
      headers: message.headers,
      metadata: message.metadata,
      scheduledAt: message.scheduledAt,
      errorMessage,
    })

    await this.messageLogRepository.save(messageLog)
  }

  private async updateMessageStatus(
    messageId: string,
    status: MessageStatus,
    errorMessage?: string,
    processingTime?: number,
  ): Promise<void> {
    const updates: any = { status }
    if (errorMessage) updates.errorMessage = errorMessage
    if (processingTime) updates.processingTime = processingTime
    if (status === MessageStatus.COMPLETED || status === MessageStatus.FAILED) {
      updates.processedAt = new Date()
    }

    await this.messageLogRepository.update({ messageId }, updates)
  }

  private async moveToDeadLetter(messageLog: MessageLog): Promise<void> {
    await this.deadLetterQueue.add("dead-letter-message", {
      messageId: messageLog.messageId,
      originalMessage: messageLog.payload,
      reason: "Max retries exceeded",
    })

    await this.updateMessageStatus(messageLog.messageId, MessageStatus.DEAD_LETTER, "Max retries exceeded")
    this.logger.warn(`Message ${messageLog.messageId} moved to dead letter queue`)
  }

  private getPriorityValue(priority?: MessagePriority): number {
    return priority ? 5 - priority : 3 // Higher number = higher priority in Bull
  }

  private getQueueByName(queueName: string): Queue {
    switch (queueName) {
      case "retry":
        return this.retryQueue
      case "dead-letter":
        return this.deadLetterQueue
      default:
        return this.messageQueue
    }
  }
}
