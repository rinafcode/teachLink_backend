import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from "typeorm"

export enum MessageStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
  DEAD_LETTER = "dead_letter",
}

export enum MessagePriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4,
}

@Entity("message_logs")
@Index(["messageId"])
@Index(["status", "createdAt"])
@Index(["sourceService", "targetService"])
export class MessageLog {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column()
  messageId: string

  @Column()
  messageType: string

  @Column()
  sourceService: string

  @Column()
  targetService: string

  @Column({
    type: "enum",
    enum: MessageStatus,
    default: MessageStatus.PENDING,
  })
  status: MessageStatus

  @Column({
    type: "enum",
    enum: MessagePriority,
    default: MessagePriority.NORMAL,
  })
  priority: MessagePriority

  @Column("jsonb")
  payload: Record<string, any>

  @Column("jsonb", { nullable: true })
  headers: Record<string, string>

  @Column("jsonb", { nullable: true })
  metadata: {
    traceId: string
    spanId: string
    correlationId: string
    retryCount: number
    maxRetries: number
    delay: number
  }

  @Column("timestamp", { nullable: true })
  scheduledAt: Date

  @Column("timestamp", { nullable: true })
  processedAt: Date

  @Column("text", { nullable: true })
  errorMessage: string

  @Column("int", { default: 0 })
  processingTime: number

  @CreateDateColumn()
  createdAt: Date
}
