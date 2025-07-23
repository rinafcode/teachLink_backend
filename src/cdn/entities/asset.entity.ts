import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm"

export enum AssetType {
  IMAGE = "image",
  VIDEO = "video",
  DOCUMENT = "document",
  STATIC = "static",
}

export enum OptimizationStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
}

@Entity("assets")
@Index(["type", "status"])
@Index(["originalUrl"])
export class Asset {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column()
  originalUrl: string

  @Column({ nullable: true })
  optimizedUrl: string

  @Column({
    type: "enum",
    enum: AssetType,
  })
  type: AssetType

  @Column({
    type: "enum",
    enum: OptimizationStatus,
    default: OptimizationStatus.PENDING,
  })
  status: OptimizationStatus

  @Column("bigint")
  originalSize: number

  @Column("bigint", { nullable: true })
  optimizedSize: number

  @Column("json", { nullable: true })
  metadata: Record<string, any>

  @Column("simple-array", { nullable: true })
  cdnUrls: string[]

  @Column({ nullable: true })
  contentHash: string

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
