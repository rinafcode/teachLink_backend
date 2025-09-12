import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ServiceStatus {
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
  DEGRADED = 'degraded',
  MAINTENANCE = 'maintenance',
}

@Entity('service_registry')
@Index(['serviceName', 'version'])
@Index(['status', 'lastHeartbeat'])
export class ServiceRegistry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  serviceName: string;

  @Column()
  serviceId: string;

  @Column()
  version: string;

  @Column()
  host: string;

  @Column('int')
  port: number;

  @Column({
    type: 'enum',
    enum: ServiceStatus,
    default: ServiceStatus.HEALTHY,
  })
  status: ServiceStatus;

  @Column('jsonb')
  metadata: {
    tags: string[];
    capabilities: string[];
    endpoints: Array<{
      path: string;
      method: string;
      description: string;
    }>;
    resources: {
      cpu: number;
      memory: number;
      disk: number;
    };
  };

  @Column('jsonb')
  healthCheck: {
    endpoint: string;
    interval: number;
    timeout: number;
    retries: number;
  };

  @Column('timestamp')
  lastHeartbeat: Date;

  @Column('int', { default: 0 })
  failureCount: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  responseTime: number;

  @Column('int', { default: 0 })
  requestCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
