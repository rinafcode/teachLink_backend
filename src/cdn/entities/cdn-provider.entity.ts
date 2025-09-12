import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ProviderType {
  CLOUDFLARE = 'cloudflare',
  AWS_CLOUDFRONT = 'aws_cloudfront',
}

export enum ProviderStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
}

@Entity('cdn_providers')
export class CDNProvider {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ProviderType,
  })
  type: ProviderType;

  @Column()
  name: string;

  @Column('json')
  config: Record<string, any>;

  @Column({
    type: 'enum',
    enum: ProviderStatus,
    default: ProviderStatus.ACTIVE,
  })
  status: ProviderStatus;

  @Column('int', { default: 1 })
  priority: number;

  @Column('simple-array')
  regions: string[];

  @Column('decimal', { precision: 5, scale: 2, default: 99.9 })
  uptime: number;

  @Column('bigint', { default: 0 })
  totalBandwidth: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
