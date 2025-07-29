import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { OrchestrationService } from './orchestration/orchestration.service';
import { AutoScalingService } from './scaling/auto-scaling.service';
import { LoadBalancingService } from './balancing/load-balancing.service';
import { DeploymentService } from './deployment/deployment.service';
import { ContainerMonitoringService } from './monitoring/container-monitoring.service';
import { Container } from './entities/container.entity';
import { ContainerCluster } from './entities/container-cluster.entity';
import { Deployment } from './entities/deployment.entity';
import { LoadBalancer } from './entities/load-balancer.entity';
import { ContainerMetrics } from './entities/container-metrics.entity';

@Global()
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      Container,
      ContainerCluster,
      Deployment,
      LoadBalancer,
      ContainerMetrics,
    ]),
    BullModule.registerQueue(
      {
        name: 'container-orchestration',
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        },
      },
      {
        name: 'auto-scaling',
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        },
      },
      {
        name: 'load-balancing',
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        },
      },
      {
        name: 'deployment-management',
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        },
      },
      {
        name: 'container-monitoring',
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        },
      }
    ),
  ],
  providers: [
    OrchestrationService,
    AutoScalingService,
    LoadBalancingService,
    DeploymentService,
    ContainerMonitoringService,
  ],
  exports: [
    OrchestrationService,
    AutoScalingService,
    LoadBalancingService,
    DeploymentService,
    ContainerMonitoringService,
  ],
})
export class ContainerModule {}
