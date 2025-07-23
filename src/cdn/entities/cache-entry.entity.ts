import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm"

export enum CacheStatus {
  ACTIVE = "active",
  EXPIRED = "expired",
  PURGED = "purged",
}

@Entity("cache_entries")
@Index(["key", "region"])
@Index(["expiresAt"])
export class CacheEntry {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ unique: true })
  key: string

  @Column()
  url: string

  @Column()
  region: string

  @Column()
  provider: string

  @Column({
    type: "enum",
    enum: CacheStatus,
    default: CacheStatus.ACTIVE,
  })
  status: CacheStatus

  @Column("timestamp")
  expiresAt: Date

  @Column("json", { nullable: true })
  headers: Record<string, string>

  @Column("bigint", { default: 0 })
  hitCount: number

  @Column("bigint", { default: 0 })
  bandwidth: number

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
