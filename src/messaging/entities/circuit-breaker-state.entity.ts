import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm"

export enum CircuitState {
  CLOSED = "closed",
  OPEN = "open",
  HALF_OPEN = "half_open",
}

@Entity("circuit_breaker_states")
@Index(["serviceName", "operation"])
export class CircuitBreakerState {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column()
  serviceName: string

  @Column()
  operation: string

  @Column({
    type: "enum",
    enum: CircuitState,
    default: CircuitState.CLOSED,
  })
  state: CircuitState

  @Column("int", { default: 0 })
  failureCount: number

  @Column("int", { default: 0 })
  successCount: number

  @Column("int", { default: 0 })
  requestCount: number

  @Column("timestamp", { nullable: true })
  lastFailureTime: Date

  @Column("timestamp", { nullable: true })
  nextAttemptTime: Date

  @Column("jsonb")
  configuration: {
    failureThreshold: number
    recoveryTimeout: number
    monitoringPeriod: number
    minimumThroughput: number
  }

  @Column("decimal", { precision: 5, scale: 2, default: 0 })
  failureRate: number

  @Column("decimal", { precision: 5, scale: 2, default: 0 })
  averageResponseTime: number

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
