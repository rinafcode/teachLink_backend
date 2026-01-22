import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tenant } from './tenant.entity';

@Entity('tenant_configs')
export class TenantConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column({ default: 'en' })
  defaultLanguage: string;

  @Column({ default: 'UTC' })
  timezone: string;

  @Column({ default: 'USD' })
  currency: string;

  @Column({ type: 'jsonb', nullable: true })
  features?: {
    analytics?: boolean;
    messaging?: boolean;
    courses?: boolean;
    assessments?: boolean;
    recommendations?: boolean;
    [key: string]: any;
  };

  @Column({ type: 'jsonb', nullable: true })
  notifications?: {
    email?: boolean;
    push?: boolean;
    sms?: boolean;
    [key: string]: any;
  };

  @Column({ type: 'jsonb', nullable: true })
  security?: {
    mfaRequired?: boolean;
    passwordPolicy?: {
      minLength?: number;
      requireNumbers?: boolean;
      requireSpecialChars?: boolean;
      requireUppercase?: boolean;
    };
    sessionTimeout?: number;
    [key: string]: any;
  };

  @Column({ type: 'jsonb', nullable: true })
  integrations?: {
    stripe?: { enabled: boolean; publicKey?: string };
    aws?: { enabled: boolean; region?: string };
    openai?: { enabled: boolean };
    [key: string]: any;
  };

  @Column({ type: 'jsonb', nullable: true })
  customSettings?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
