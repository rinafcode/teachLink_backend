import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from "typeorm"

export enum CheckType {
  CONSISTENCY = "consistency",
  COMPLETENESS = "completeness",
  REFERENTIAL_INTEGRITY = "referential_integrity",
  SCHEMA_VALIDATION = "schema_validation",
}

export enum CheckStatus {
  PASSED = "passed",
  FAILED = "failed",
  WARNING = "warning",
  RUNNING = "running",
}

@Entity("integrity_checks")
@Index(["entityType", "checkType"])
@Index(["status", "createdAt"])
export class IntegrityCheck {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column()
  entityType: string

  @Column({
    type: "enum",
    enum: CheckType,
  })
  checkType: CheckType

  @Column({
    type: "enum",
    enum: CheckStatus,
  })
  status: CheckStatus

  @Column("simple-array")
  dataSources: string[]

  @Column("int", { default: 0 })
  recordsChecked: number

  @Column("int", { default: 0 })
  inconsistenciesFound: number

  @Column("jsonb", { nullable: true })
  details: {
    errors: Array<{
      entityId: string
      field: string
      expected: any
      actual: any
      source: string
    }>
    warnings: Array<{
      entityId: string
      message: string
      source: string
    }>
  }

  @Column("int")
  durationMs: number

  @Column("timestamp")
  startTime: Date

  @Column("timestamp", { nullable: true })
  endTime: Date

  @CreateDateColumn()
  createdAt: Date
}
