import { Processor, Process } from "@nestjs/bull"
import { Logger } from "@nestjs/common"
import type { Job } from "bull"
import type { MessageQueueService } from "../services/message-queue.service"
import type { DistributedTracingService } from "../services/distributed-tracing.service"
import type { Message } from "../interfaces/messaging.interfaces"

@Processor("message-queue")
export class MessageProcessor {
  private readonly logger = new Logger(MessageProcessor.name)

  constructor(
    private readonly messageQueueService: MessageQueueService,
    private readonly tracingService: DistributedTracingService,
  ) {}

  @Process("process-message")
  async processMessage(job: Job<Message>) {
    const message = job.data
    const span = this.tracingService.startSpan("message.process", {
      messageId: message.id,
      messageType: message.type,
      source: message.source,
      target: message.target,
    })

    try {
      this.logger.log(`Processing message ${message.id} of type ${message.type}`)

      // Simulate message processing
      await this.simulateMessageProcessing(message)

      span.setTag("success", true)
      this.logger.log(`Message ${message.id} processed successfully`)
    } catch (error) {
      span.setTag("error", true)
      span.setTag("error.message", error.message)
      this.logger.error(`Failed to process message ${message.id}: ${error.message}`)
      throw error
    } finally {
      span.finish()
    }
  }

  @Process("retry-message")
  async retryMessage(job: Job<{ messageId: string; originalMessage: any }>) {
    const { messageId, originalMessage } = job.data

    this.logger.log(`Retrying message ${messageId}`)

    // Re-queue the original message
    await this.messageQueueService.sendMessage(originalMessage)
  }

  @Process("dead-letter-message")
  async handleDeadLetterMessage(job: Job<{ messageId: string; originalMessage: any; reason: string }>) {
    const { messageId, reason } = job.data

    this.logger.warn(`Message ${messageId} moved to dead letter queue: ${reason}`)

    // Here you could implement additional logic like:
    // - Send alerts
    // - Store in a separate dead letter store
    // - Trigger manual review process
  }

  private async simulateMessageProcessing(message: Message): Promise<void> {
    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000))

    // Simulate occasional failures for testing
    if (Math.random() < 0.1) {
      // 10% failure rate
      throw new Error("Simulated processing failure")
    }
  }
}
