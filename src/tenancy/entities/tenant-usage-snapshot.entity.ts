import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('tenant_usage_snapshots')
@Index(['tenantId', 'period'])
export class TenantUsageSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @Column()
  period: string;

  @Column({ default: 0 })
  userCount: number;

  @Column({ default: 0 })
  storageUsedMb: number;

  @Column({ default: 0 })
  apiCallCount: number;

  @CreateDateColumn()
  snapshotAt: Date;
}