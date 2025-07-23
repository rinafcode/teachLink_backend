import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm"

export enum ReplicationState {
  ACTIVE = "active",
  PAUSED = "paused",
  ERROR = "error",
  SYNCING = "syncing",
}

@Entity("replication_status")
@Index(["sourceRegion", "targetRegion"])
@Index(["entityType"])
export class ReplicationStatus {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column()
  entityType: string

  @Column()
  sourceRegion: string

  @Column()
  targetRegion: string

  @Column({
    type: "enum",
    enum: ReplicationState,
    default: ReplicationState.ACTIVE,
  })
  state: ReplicationState

  @Column("bigint", { default: 0 })
  lastSyncedVersion: number

  @Column("timestamp", { nullable: true })
  lastSyncTime: Date

  @Column("int", { default: 0 })
  pendingEvents: number

  @Column("int", { default: 0 })
  failedEvents: number

  @Column("decimal", { precision: 5, scale: 2, default: 0 })
  lagSeconds: number

  @Column("jsonb", { nullable: true })
  configuration: Record<string, any>

  @Column("text", { nullable: true })
  lastError: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
