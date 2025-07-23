import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from "typeorm"

export enum ConflictType {
  VERSION_CONFLICT = "version_conflict",
  CONCURRENT_UPDATE = "concurrent_update",
  DATA_INCONSISTENCY = "data_inconsistency",
  SCHEMA_MISMATCH = "schema_mismatch",
}

export enum ResolutionStrategy {
  LAST_WRITE_WINS = "last_write_wins",
  FIRST_WRITE_WINS = "first_write_wins",
  MERGE = "merge",
  MANUAL = "manual",
  CUSTOM = "custom",
}

export enum ConflictStatus {
  DETECTED = "detected",
  RESOLVING = "resolving",
  RESOLVED = "resolved",
  FAILED = "failed",
}

@Entity("conflict_logs")
@Index(["entityType", "entityId"])
@Index(["conflictType", "status"])
@Index(["createdAt"])
export class ConflictLog {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column()
  entityType: string

  @Column()
  entityId: string

  @Column({
    type: "enum",
    enum: ConflictType,
  })
  conflictType: ConflictType

  @Column({
    type: "enum",
    enum: ResolutionStrategy,
  })
  resolutionStrategy: ResolutionStrategy

  @Column({
    type: "enum",
    enum: ConflictStatus,
    default: ConflictStatus.DETECTED,
  })
  status: ConflictStatus

  @Column("jsonb")
  conflictingData: {
    source1: Record<string, any>
    source2: Record<string, any>
    metadata: Record<string, any>
  }

  @Column("jsonb", { nullable: true })
  resolvedData: Record<string, any>

  @Column("text", { nullable: true })
  resolutionReason: string

  @Column("timestamp")
  detectedAt: Date

  @Column("timestamp", { nullable: true })
  resolvedAt: Date

  @Column("simple-array")
  affectedSources: string[]

  @CreateDateColumn()
  createdAt: Date
}
