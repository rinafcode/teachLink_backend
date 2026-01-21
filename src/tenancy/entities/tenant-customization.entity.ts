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

@Entity('tenant_customizations')
export class TenantCustomization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column({ nullable: true })
  logoUrl?: string;

  @Column({ nullable: true })
  faviconUrl?: string;

  @Column({ nullable: true })
  primaryColor?: string;

  @Column({ nullable: true })
  secondaryColor?: string;

  @Column({ nullable: true })
  accentColor?: string;

  @Column({ nullable: true })
  fontFamily?: string;

  @Column({ type: 'jsonb', nullable: true })
  theme?: {
    mode?: 'light' | 'dark' | 'auto';
    colors?: Record<string, string>;
    fonts?: Record<string, string>;
    spacing?: Record<string, string>;
    [key: string]: any;
  };

  @Column({ type: 'text', nullable: true })
  customCss?: string;

  @Column({ type: 'text', nullable: true })
  customJs?: string;

  @Column({ type: 'jsonb', nullable: true })
  emailTemplates?: {
    welcome?: string;
    passwordReset?: string;
    notification?: string;
    [key: string]: any;
  };

  @Column({ type: 'jsonb', nullable: true })
  landingPageConfig?: {
    hero?: {
      title?: string;
      subtitle?: string;
      backgroundImage?: string;
    };
    features?: Array<{
      title: string;
      description: string;
      icon?: string;
    }>;
    [key: string]: any;
  };

  @Column({ nullable: true })
  customDomain?: string;

  @Column({ default: false })
  customDomainVerified: boolean;

  @Column({ type: 'jsonb', nullable: true })
  socialLinks?: {
    facebook?: string;
    twitter?: string;
    linkedin?: string;
    instagram?: string;
    [key: string]: string;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
